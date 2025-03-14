const Organization = require("../../database/model/organization");
const Customer = require("../../database/model/customer");
const Settings = require("../../database/model/settings");
const Prefix = require("../../database/model/prefix");
const DefAcc = require("../../database/model/defaultAccount");
const Account = require("../../database/model/account");
const TrialBalance = require("../../database/model/trialBalance");
const Item = require("../../database/model/item");
const Staff = require("../../database/model/staff");

const SewnexOrder = require("../model/sxOrder");
const Service = require("../model/service");
const SewnexOrderService = require("../model/sxOrderService");
const InternalOrder = require("../model/internalOrder");
const CPS = require("../model/cps");

const { cleanData } = require("../../services/cleanData");
const { singleCustomDateTime, multiCustomDateTime } = require("../../services/timeConverter");

const mongoose = require('mongoose');
const moment = require("moment-timezone");


// Fetch existing data
const dataExist = async ( organizationId, designerId, serviceIds) => {
    const [organizationExists, staffExist, settings, existingPrefix, services, allFabrics, allReadyMade, allStyle, allParameter  ] = await Promise.all([
      Organization.findOne({ organizationId }, { organizationId: 1, organizationCountry: 1, state: 1, timeZoneExp: 1 }),
      Staff.findOne({ organizationId , _id:designerId }),
      Settings.findOne({ organizationId },{ stockBelowZero:1, salesOrderAddress: 1, salesOrderCustomerNote: 1, salesOrderTermsCondition: 1, salesOrderClose: 1, restrictSalesOrderClose: 1, termCondition: 1 ,customerNote: 1 }),
      Prefix.findOne({ organizationId }),
      Service.find({ organizationId, _id: { $in: serviceIds }})
      .lean(),
      Item.find({ organizationId, type: 'Fabric' })
      .lean(),
      Item.find({ organizationId, type: 'Ready Made' })
      .lean(),
      CPS.find({ organizationId, type: 'style' }),
      CPS.find({ organizationId, type: 'parameter'})
    ]);
    return { organizationExists, staffExist, settings, existingPrefix, services, allFabrics, allReadyMade, allStyle, allParameter };
};




// Add Sewnex Internal Order
exports.addIntOrder = async (req, res) => {
    console.log("Add Order", req.body);
    
    try {
        const { organizationId, id: userId } = req.user;

        const cleanedData = cleanData(req.body);
        
        cleanedData.service = cleanedData.service
        ?.map(data => cleanData(data))
        .filter(service => service.serviceId !== undefined && service.serviceId !== '') || [];
        
        const { designerId, service } = cleanedData;
        
        const serviceIds = service.map(service => service.serviceId);

        // Check for duplicate itemIds
        // const uniqueItemIds = new Set(serviceIds);
        // if (uniqueItemIds.size !== serviceIds.length) {
        //   return res.status(400).json({ message: "Duplicate service found" });
        // }        

        // Validate serviceIds
        const invalidServiceIds = serviceIds.filter(serviceId => !mongoose.Types.ObjectId.isValid(serviceId) || serviceId.length !== 24);
        if (invalidServiceIds.length > 0) {
          return res.status(400).json({ message: `Invalid service IDs: ${invalidServiceIds.join(', ')}` });
        } 


        const { organizationExists, staffExist, existingPrefix, services, allFabrics, allReadyMade, allStyle, allParameter } = await dataExist(organizationId, designerId, serviceIds);

        const allData = { allParameter, allFabrics, allReadyMade, allStyle, services };
        
        if (!validateOrganizationTaxCurrency( organizationExists, staffExist, existingPrefix, res )) return;
        
        //Validate Inputs
        if (!validateInputs( cleanedData, allData, res)) return;

        //Prefix
        await internalOrderPrefix(cleanedData, existingPrefix );


        cleanedData.createdDateTime = moment.tz(cleanedData.internalOrderDate, "YYYY-MM-DDTHH:mm:ss.SSS[Z]", organizationExists.timeZoneExp).toISOString();           
        
        const orderServices = await Promise.all(service.map(async (serviceItem) => {
            await salesOrderServicePrefix(serviceItem,existingPrefix);
            const newOrderService = new SewnexOrderService({
                ...serviceItem,
                organizationId
            });
            return await newOrderService.save();
        }));

        existingPrefix.save();


        cleanedData.service = orderServices.map(service => ({
            orderServiceId: service._id,
        }));

        const newOrder = new InternalOrder({
            ...cleanedData,
            organizationId,
            userId,
        });

        const savedOrder = await newOrder.save();


        console.log( "Internal Order created successfully:", savedOrder );

        res.status(201).json({
            message: "Internal Order created successfully",
            data: savedOrder
        });

    } catch (error) {
        console.error("Error creating Internal Order:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get All Orders
exports.getAllOrders = async (req, res) => {
    try {
        const { organizationId } = req.user;

        const { organizationExists, orders } = await dataExist(organizationId);

        if (!orders?.length) {
            return res.status(404).json({ message: "No orders found" });
        }

        const formattedOrders = multiCustomDateTime(
            orders,
            organizationExists.dateFormatExp,
            organizationExists.timeZoneExp
        );

        res.status(200).json(formattedOrders);

    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get One Order
exports.getOneOrder = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { orderId } = req.params;

        const { organizationExists, order } = await dataExist(organizationId, null, orderId);

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        const formattedOrder = singleCustomDateTime(
            order,
            organizationExists.dateFormatExp,
            organizationExists.timeZoneExp
        );

        res.status(200).json(formattedOrder);

    } catch (error) {
        console.error("Error fetching order:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


























// Validate Organization Tax Currency
function validateOrganizationTaxCurrency( organizationExists, staffExist, existingPrefix, res ) {
    if (!organizationExists) {
      res.status(404).json({ message: "Organization not found" });
      return false;
    }
    if (!staffExist) {
      res.status(404).json({ message: "Staff not found" });
      return false;
    }
    if (!existingPrefix) {
      res.status(404).json({ message: "Prefix not found" });
      return false;
    }
    return true;
  }
    


//Validate inputs
function validateInputs( cleanedData, allData, res) {
    const validationErrors = validateOrderData( cleanedData, allData  );


  
    if (validationErrors.length > 0) {
      res.status(400).json({ message: validationErrors.join(", ") });
      return false;
    }
    return true;
 }



//Validate Data
function validateOrderData( data, allData ) {
    const errors = [];    
  
    //Basic Info
    validateReqFields( data, errors );
    validateService( data.service, data.productId, allData, errors);
  
  
  
  
    //OtherDetails
    //validateAlphanumericFields([''], data, errors);
    // validateIntegerFields([''], data, errors);
    // validateFloatFields([''], data, errors);
    //validateAlphabetsFields([''], data, errors);
  
    //Tax Details
    // validatePlaceOfSupply(data.placeOfSupply, organizationExists, errors);
  
    return errors;
}

// Field validation utility
function validateField(condition, errorMsg, errors) {
    if (condition) errors.push(errorMsg);
}

//Valid Req Fields
function validateReqFields( data, errors ) {
    validateField( typeof data.saleOrderDate === 'undefined', "Sale Order Date required", errors  );
}







// Function to Validate Item Table 
function validateService(data, productId, allData, errors) {     
    
    const { allParameter, allFabrics, allReadyMade, allStyle, services } = allData;    

    // Check for service count mismatch
    validateField(data.length !== services.length, "Mismatch in service count between request and database.", errors);

    const fetchedReadyMade = allReadyMade.find(f => f._id.toString() === productId.toString());

    // Check if product exists 
    validateField(!fetchedReadyMade, `Product was not found.`, errors);
    if (!fetchedReadyMade) return;

     // Iterate through each service to validate individual fields
    data.forEach((svc, svcIndex) => {
        const fetchedService = services.find(s => s._id.toString() === svc.serviceId.toString());

        // Check if service exists in the service table
        validateField(!fetchedService, `Service with ID ${svc.serviceId} was not found.`, errors);
        if (!fetchedService) return;


        // Validate individual service fields

        // validateField(svc.serviceCharge !== fetchedService.serviceCharge, `Service rate mismatch for service ${svc.serviceName}: ${svc.serviceCharge}`, errors);
        validateField( typeof svc.serviceName === 'undefined', "Please select a valid service", errors  );
        validateField( typeof svc.status === 'undefined', "Status required", errors  );

      



        // Validate fabrics within the service

        svc.fabric.forEach((fabric) => {
            const fetchedFabric = allFabrics.find(f => f._id.toString() === fabric.itemId.toString());

            // Check if fabric exists in the fabric table
            validateField(!fetchedFabric, `Fabric with ID ${fabric.itemId} was not found.`, errors);
            if (!fetchedFabric) return;
           

            // Validate individual fabric fields

            validateField( typeof fabric.itemName === 'undefined', "Please select a valid fabric", errors  );
            validateField( typeof fabric.quantity === 'undefined', "Quantity required", errors  );


            // validateField(fabric.sellingPrice !== fetchedFabric.sellingPrice, `Selling price mismatch for fabric ${fabric.itemName}: ${fabric.sellingPrice}`, errors);
        });





        // Validate styles within the service

        svc.style.forEach((style) => {
            const fetchedStyle = allStyle.find(st => st._id.toString() === style.styleId.toString());

            // Check if style exists in the style table
            validateField(!fetchedStyle, `Style with ID ${style.styleId} was not found.`, errors);
            if (!fetchedStyle) return;

            // Validate individual style fields
            // validateField(style.styleRate !== fetchedStyle.styleRate, `Style rate mismatch for style ${style.styleId}: ${style.styleRate}`, errors);

            validateField( typeof style.styleName === 'undefined', "Please select a valid style", errors  );




        });

        // Validate measurements within the service

        svc.measurement.forEach((measurement) => {
            const fetchedMeasurement = allParameter.find(param => param._id.toString() === measurement.parameterId.toString());

            // Check if measurement parameter exists in the parameter table
            validateField(!fetchedMeasurement, `Measurement parameter with ID ${measurement.parameterId} was not found.`, errors);
            if (!fetchedMeasurement) return;

            // Validate individual measurement fields
            // validateField(measurement.value !== fetchedMeasurement.value, `Measurement value mismatch for parameter ${measurement.parameterId}: ${measurement.value}`, errors);
        });

    });
}


























// Sales Prefix
function internalOrderPrefix( cleanData, existingPrefix ) {
  const activeSeries = existingPrefix.series.find(series => series.status === true);
  if (!activeSeries) {
    return res.status(404).json({ message: "No active series found for the organization." });
  }
  cleanData.internalOrder = `${activeSeries.internalOrder}${activeSeries.internalOrderNum}`;

  activeSeries.internalOrderNum += 1;

}



// Sales Order Prefix
async function salesOrderServicePrefix(cleanData,existingPrefix) {
  const activeSeries = existingPrefix.series.find(series => series.status === true);
  if (!activeSeries) {
    return res.status(404).json({ message: "No active series found for the organization." });
  }
  cleanData.orderId = `${activeSeries.order}${activeSeries.orderNum}`;

  activeSeries.orderNum += 1;

}









exports.dataExist = {
    dataExist,
};
exports.validation = {
    validateOrganizationTaxCurrency, 
    validateInputs
};
exports.prefix = {
    salesOrderServicePrefix
};
