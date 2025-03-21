const Organization = require("../../database/model/organization");
const Customer = require("../../database/model/customer");
const Settings = require("../../database/model/settings");
const Prefix = require("../../database/model/prefix");
const DefAcc = require("../../database/model/defaultAccount");
const Account = require("../../database/model/account");
const TrialBalance = require("../../database/model/trialBalance");
const Item = require("../../database/model/item");

const SewnexOrder = require("../model/sxOrder");
const Service = require("../model/service");
const SewnexOrderService = require("../model/sxOrderService");
const CPS = require("../model/cps");
const OrderStatus = require("../model/orderStatus");
const SewnexSetting = require("../model/sxSetting");
const ServiceManufacture = require("../model/serviceManufacture")

const { cleanData } = require("../../services/cleanData");
const { singleCustomDateTime, multiCustomDateTime } = require("../../services/timeConverter");

const mongoose = require('mongoose');
const moment = require("moment-timezone");


// Fetch existing data
const dataExist = async ( organizationId, customerId, serviceIds, orderId) => {
    const [organizationExists, customerExist, settings, existingPrefix, defaultAccount, customerAccount, services, allFabrics, allRawMaterial, allStyle, allParameter, sewnexSetting ] = await Promise.all([
      Organization.findOne({ organizationId },{ timeZoneExp: 1, dateFormatExp: 1, dateSplit: 1, organizationCountry: 1, state : 1 }).lean(),
      Customer.findOne({ organizationId , _id:customerId }, { _id: 1, customerDisplayName: 1, taxType: 1 }),
      Settings.findOne({ organizationId },{ stockBelowZero:1, salesOrderAddress: 1, salesOrderCustomerNote: 1, salesOrderTermsCondition: 1, salesOrderClose: 1, restrictSalesOrderClose: 1, termCondition: 1 ,customerNote: 1 }),
      Prefix.findOne({ organizationId }),
      DefAcc.findOne({ organizationId },{ salesAccount: 1, salesDiscountAccount: 1, outputCgst: 1, outputSgst: 1, outputIgst: 1 ,outputVat: 1 }),
      Account.findOne({ organizationId , accountId:customerId },{ _id:1, accountName:1 }),
      Service.find({ organizationId, _id: { $in: serviceIds }})
      .lean(),
      Item.find({ organizationId, type: 'Fabric' })
      .lean(),
      Item.find({ organizationId, type: 'Raw Material' })
      .lean(),
      CPS.find({ organizationId, type: 'style' }),
      CPS.find({ organizationId, type: 'parameter'}),
      SewnexSetting.findOne({ organizationId })      
    ]);
    return { organizationExists, customerExist, settings, existingPrefix, defaultAccount, customerAccount, services, allFabrics, allRawMaterial, allStyle, allParameter, sewnexSetting };
};


// Fetch Acc existing data
const accDataExists = async ( organizationId, otherExpenseAccountId, freightAccountId, depositAccountId ) => {
  console.log("accDataExists", organizationId, otherExpenseAccountId, freightAccountId, depositAccountId);
  
  const [ otherExpenseAcc, freightAcc, depositAcc ] = await Promise.all([
    Account.findOne({ organizationId , _id: otherExpenseAccountId, accountHead: "Expenses" }, { _id:1, accountName: 1 }),
    Account.findOne({ organizationId , _id: freightAccountId, accountHead: "Expenses" }, { _id:1, accountName: 1 }),
    Account.findOne({ organizationId , _id: depositAccountId, accountHead: "Asset" }, { _id:1, accountName: 1 }),
  ]);
  return { otherExpenseAcc, freightAcc, depositAcc };
};




//Get one and All
const salesDataExist = async ( organizationId, orderId, orderServiceId ) => {    
  const [organizationExists, orderJournal, allOrder, order, serviceOrder ] = await Promise.all([
    Organization.findOne({ organizationId },{ timeZoneExp: 1, dateFormatExp: 1, dateSplit: 1, organizationCountry: 1, state: 1 }).lean(),
    TrialBalance.find({ organizationId: organizationId, operationId : orderId })
    .populate('accountId', 'accountName')    
    .lean(),
    SewnexOrder.find({ organizationId })
    .populate('customerId','customerDisplayName mobile')  
    .populate('service.orderServiceId.style.styleId').populate({
      path: 'service.orderServiceId',
        populate: [
          { path: 'serviceId', select: 'serviceName' }, 
          { path: 'fabric.itemId', select: 'itemName' }, 
          { path: 'style.styleId',select: 'name' }, 
          { path: 'measurement.parameterId',select: 'name' }, 
        ]
       })
    .lean(),
    SewnexOrder.findOne({ organizationId, _id: orderId })
    .populate('customerId','customerDisplayName customerEmail mobile membershipCardNumber customerAddress')  
    .populate('service.orderServiceId.style.styleId').populate({
        path: 'service.orderServiceId',
        populate: [
          { path: 'serviceId', select: 'serviceName salesAccountId' }, 
          { path: 'fabric.itemId', select: 'itemName salesAccountId' }, 
          { path: 'style.styleId',select: 'name' }, 
          { path: 'measurement.parameterId',select: 'name' }, 
        ]
       })
    .lean(),
    SewnexOrderService.findOne({ organizationId, _id: orderServiceId })
    .lean()
  ]);
  return { organizationExists, orderJournal, allOrder, order, serviceOrder };
};








// Add Sewnex Order
exports.addOrder = async (req, res) => {
    console.log("Add Order", req.body);
    
    try {
        const { organizationId, id: userId } = req.user;

        const cleanedData = cleanData(req.body);

        cleanedData.service = cleanedData.service
          ?.map(data => {
            const cleanedService = cleanData(data);
          
            ['fabric', 'measurement', 'style', 'referenceImage'].forEach(key => {
              cleanedService[key] = cleanedService[key]?.map(item => cleanData(item)) ?? [];
            });
          
            return cleanedService;
          })
          .filter(service => service.serviceId) || [];
        
        
        const { customerId, service } = cleanedData;
        
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


        const { organizationExists, customerExist, existingPrefix, defaultAccount, services, allFabrics, allRawMaterial, allStyle, allParameter, customerAccount } = await dataExist(organizationId, customerId, serviceIds, null);

        const allData = { allParameter, allFabrics, allRawMaterial, allStyle, services };
        
        if (!validateOrganizationTaxCurrency( organizationExists, customerExist, existingPrefix, defaultAccount, res )) return;
        
        //Validate Inputs
        if (!validateInputs( cleanedData, customerExist, defaultAccount, allData, res)) return;

         //Tax Type
        taxType(cleanedData, customerExist, organizationExists );

        //Default Account
        const { defAcc, error } = await defaultAccounting( cleanedData, defaultAccount, organizationExists, organizationId );
        if (error) { 
          res.status(400).json({ message: error }); 
          return false; 
        }

        // Calculate Sales 
        if (!calculateSalesOrder( cleanedData, res )) return;

        //Sales Journal      
        if (!salesJournal( cleanedData, res )) return;         
        
        //Prefix
        await salesOrderPrefix(cleanedData, existingPrefix );


        cleanedData.createdDateTime = moment.tz(cleanedData.saleOrderDate, "YYYY-MM-DDTHH:mm:ss.SSS[Z]", organizationExists.timeZoneExp).toISOString();           
        

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

        const newOrder = new SewnexOrder({
            ...cleanedData,
            organizationId,
            userId,
        });

        const savedOrder = await newOrder.save();

        //Journal
        await journal( savedOrder, defAcc, customerAccount );

        // Add order status entry
        for (const service of savedOrder.service) {
          const orderStatusEntry = await OrderStatus.create({
            organizationId,
            orderServiceId: service.orderServiceId,
            orderStatus: [{
              status: "Order Placed",
              date: savedOrder.saleOrderDate,
            }],
            remarks: "Order has been successfully placed.",
            userId,
            createdDateTime: new Date()
          });
          console.log("orderStatusEntry:",orderStatusEntry);
        }
          
        console.log( "Sale Order created successfully:", savedOrder );
        res.status(201).json({ message: "Sale Order created successfully", data: savedOrder });

    } catch (error) {
        console.error("Error creating Sale Order:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get All Orders
exports.getAllOrders = async (req, res) => {
    try {
        const { organizationId } = req.user;

        const { organizationExists, allOrder } = await salesDataExist( organizationId, null, null );

        if (!allOrder?.length) {
            return res.status(404).json({ message: "No orders found" });
        }

        const transformedOrder = allOrder.map(data => {
          return {
              ...data,
              customerId: data.customerId?._id,  
              customerDisplayName: data.customerId?.customerDisplayName,
              mobile:  data.customerId?.mobile,

              service: data.service.map(services => ({
                ...services,
                _id: services?._id,
                orderServiceId: services?.orderServiceId?._id,
                serviceId: services?.orderServiceId?.serviceId?._id,
                serviceName: services?.orderServiceId?.serviceId?.serviceName,


                fabric: services?.orderServiceId?.fabric.map(fabric => ({
                  ...fabric,
                  itemId: fabric?.itemId?._id,
                  itemName: fabric?.itemId?.itemName,
                })),


                measurement: services?.orderServiceId?.measurement.map(measurement => ({
                  parameterId: measurement?.parameterId?._id,
                  parameterName: measurement?.parameterId?.name,
                  value: measurement?.value
                })),


                style: services?.orderServiceId?.style.map(style => ({
                  ...style,
                  styleId: style?.styleId?._id,
                  styleName: style?.styleId?.name,
                })),



                cgst: services?.orderServiceId?.cgst,
                sgst: services?.orderServiceId?.sgst,
                igst: services?.orderServiceId?.igst,
                vat: services?.orderServiceId?.vat,
                taxRate: services?.orderServiceId?.taxRate,
                cgstService: services?.orderServiceId?.cgstService,
                sgstService: services?.orderServiceId?.sgstService,
                igstService: services?.orderServiceId?.igstService,
                vatService: services?.orderServiceId?.vatService,               
                
                trialDate: services?.orderServiceId?.trialDate,
                deliveryDate: services?.orderServiceId?.deliveryDate,
                requiredWorkingDay: services?.orderServiceId?.requiredWorkingDay,

                serviceRate: services?.orderServiceId?.serviceRate,
                serviceTax: services?.orderServiceId?.serviceTax,
                serviceAmount: services?.orderServiceId?.serviceAmount,

                fabricRate: services?.orderServiceId?.fabricRate,
                fabricTax: services?.orderServiceId?.fabricTax,

                rawMaterialRate: services?.orderServiceId?.rawMaterialRate,
                rawMaterialTax: services?.orderServiceId?.rawMaterialTax,

                styleRate: services?.orderServiceId?.styleRate,
                styleTax: services?.orderServiceId?.styleTax,

                totalRate: services?.orderServiceId?.totalRate,
                totalTax: services?.orderServiceId?.totalTax,

                cgstAmount: services?.orderServiceId?.cgstAmount,
                sgstAmount: services?.orderServiceId?.sgstAmount,
                igstAmount: services?.orderServiceId?.igstAmount,
                vatAmount: services?.orderServiceId?.vatAmount,

                itemTotal: services?.orderServiceId?.itemTotal,
                
                status: services?.orderServiceId?.status,
                createDateTime: services?.orderServiceId?.createDateTime,
              })),  
          };});

          const formattedObjects = multiCustomDateTime(transformedOrder, organizationExists.dateFormatExp, organizationExists.timeZoneExp, organizationExists.dateSplit );       

          res.status(200).json(formattedObjects);

    } catch (error) {
        console.error("Error fetching orders1:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get One Order
exports.getOneOrder = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { orderId } = req.params;

        const { organizationExists, order } = await salesDataExist(organizationId, orderId, null);

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        const transformedOrder = {
              ...order,
              customerId: order.customerId?._id,  
              customerDisplayName: order.customerId?.customerDisplayName,
              customerEmail: order.customerId?.customerEmail,
              mobile: order.customerId?.mobile,
              membershipCardNumber: order.customerId?.membershipCardNumber,
              customerAddress: order.customerId?.customerAddress,


              service: order.service.map(services => ({
                ...services,
                _id: services?._id,
                orderServiceId: services?.orderServiceId?._id,
                serviceId: services?.orderServiceId?.serviceId?._id,
                serviceName: services?.orderServiceId?.serviceId?.serviceName,
                salesAccountId: services?.orderServiceId?.serviceId?.salesAccountId,


                fabric: services?.orderServiceId?.fabric.map(fabric => ({
                  ...fabric,
                  itemId: fabric?.itemId?._id,
                  itemName: fabric?.itemId?.itemName,
                  salesAccountId: fabric?.itemId?.salesAccountId,
      
                })),


                measurement: services?.orderServiceId?.measurement.map(measurement => ({
                  parameterId: measurement?.parameterId?._id,
                  parameterName: measurement?.parameterId?.name,
                  value: measurement?.value
                })),


                style: services?.orderServiceId?.style.map(style => ({
                  ...style,
                  styleId: style?.styleId?._id,
                  styleName: style?.styleId?.name,
                })),

                cgst: services?.orderServiceId?.cgst,
                sgst: services?.orderServiceId?.sgst,
                igst: services?.orderServiceId?.igst,
                vat: services?.orderServiceId?.vat,
                taxRate: services?.orderServiceId?.taxRate,
                cgstService: services?.orderServiceId?.cgstService,
                sgstService: services?.orderServiceId?.sgstService,
                igstService: services?.orderServiceId?.igstService,
                vatService: services?.orderServiceId?.vatService,               
                
                trialDate: services?.orderServiceId?.trialDate,
                deliveryDate: services?.orderServiceId?.deliveryDate,
                requiredWorkingDay: services?.orderServiceId?.requiredWorkingDay,

                serviceRate: services?.orderServiceId?.serviceRate,
                serviceTax: services?.orderServiceId?.serviceTax,
                serviceAmount: services?.orderServiceId?.serviceAmount,

                fabricRate: services?.orderServiceId?.fabricRate,
                fabricTax: services?.orderServiceId?.fabricTax,

                rawMaterialRate: services?.orderServiceId?.rawMaterialRate,
                rawMaterialTax: services?.orderServiceId?.rawMaterialTax,

                styleRate: services?.orderServiceId?.styleRate,
                styleTax: services?.orderServiceId?.styleTax,

                totalRate: services?.orderServiceId?.totalRate,
                totalTax: services?.orderServiceId?.totalTax,

                cgstAmount: services?.orderServiceId?.cgstAmount,
                sgstAmount: services?.orderServiceId?.sgstAmount,
                igstAmount: services?.orderServiceId?.igstAmount,
                vatAmount: services?.orderServiceId?.vatAmount,

                itemTotal: services?.orderServiceId?.itemTotal,
                
                status: services?.orderServiceId?.status,
                createDateTime: services?.orderServiceId?.createDateTime,
              })),  
          };

          const formattedObjects = singleCustomDateTime(transformedOrder, organizationExists.dateFormatExp, organizationExists.timeZoneExp, organizationExists.dateSplit );       

        res.status(200).json(formattedObjects);

    } catch (error) {
        console.error("Error fetching order2:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};



// Get Last Invoice Prefix
exports.getLastOrderPrefix = async (req, res) => {
  try {
      const organizationId = req.user.organizationId;

      // Find all accounts where organizationId matches
      const prefix = await Prefix.findOne({ organizationId:organizationId,'series.status': true });

      if (!prefix) {
          return res.status(404).json({
              message: "No Prefix found for the provided organization ID.",
          });
      }
      
      const series = prefix.series[0];     
      const lastPrefix = series.salesOrder + series.salesOrderNum;

      res.status(200).json(lastPrefix);
  } catch (error) {
      console.error("Error fetching accounts:", error);
      res.status(500).json({ message: "Internal server error." });
  }
};



// Get Invoice Journal
exports.orderJournal = async (req, res) => {
  try {
      const organizationId = req.user.organizationId;
      const { orderId } = req.params;

      const { orderJournal } = await salesDataExist( organizationId, orderId, null );      

      if (!orderJournal) {
          return res.status(404).json({
              message: "No Journal found for the Invoice.",
          });
      }

      const transformedJournal = orderJournal.map(item => {
        return {
            ...item,
            accountId: item.accountId?._id,  
            accountName: item.accountId?.accountName,  
        };
    });

    res.status(200).json(transformedJournal);
  } catch (error) {
      console.error("Error fetching journal:", error);
      res.status(500).json({ message: "Internal server error." });
  }
};









// manufacturingProcessing
exports.manufacturingProcessing = async (req, res) => {
  console.log("Manufacturing Processing", req.body);
  try {
      const organizationId = req.user.organizationId;
      const { orderServiceId } = req.params;
      const cleanedData = cleanData(req.body);

      const { sewnexSetting } = await dataExist(organizationId, null, null, null);

      const { serviceOrder } = await salesDataExist(organizationId, null, orderServiceId);

      const { manufacturingStatus } = sewnexSetting;
      console.log(serviceOrder.status);
      

      if (!serviceOrder) {
        console.log("No Service Order found for the Invoice." );        
        return res.status(404).json({ message: "No Service Order found for the Invoice." });
      }

      if (serviceOrder.status !== 'Manufacturing') {
        console.log("Service is not in Manufacturing status.");        
        return res.status(404).json({ message: "Service is not in Manufacturing status." });
      }

      // Check if cleanedData.manufacturingStatus exists in manufacturingStatus array
      const isValidManufacturingStatus = manufacturingStatus.some(
        status => status.manufacturingStatusName === cleanedData.manufacturingStatus
      );

      if (!isValidManufacturingStatus) {
        console.log("Invalid manufacturing status.");        
        return res.status(400).json({ message: "Invalid manufacturing status." });
      }

      const existingServiceManufacture = await ServiceManufacture.findOne( { organizationId, orderServiceId, status:cleanedData.manufacturingStatus } );

      if(existingServiceManufacture){
        //Update existing Service Manufacture
        const updatedServiceManufacture = await ServiceManufacture.updateOne( { organizationId, orderServiceId , status:cleanedData.manufacturingStatus }, { $set: cleanedData } );
        
        //Update service Order
        const updatedServiceOrder = await SewnexOrderService.updateOne( { organizationId, _id: orderServiceId }, { $set: cleanedData } );
        if (updatedServiceOrder.nModified === 0){
          return res.status(404).json({ message: "Service Order is not in Manufacturing status." });
          }
        return res.status(200).json( {message: "Manufacturing process updated" , updatedServiceManufacture});

      }else{
        //New Service Manufacture
        const newServiceManufacture = await ServiceManufacture.create( { organizationId, orderServiceId , ...cleanedData } );

        //Update Service Order
        const updatedServiceOrder = await SewnexOrderService.updateOne( { organizationId, _id: orderServiceId }, { $set: cleanedData } );
        if (updatedServiceOrder.nModified === 0){
          return res.status(404).json({ message: "Service Order is not in Manufacturing status." });
          }

        return res.status(201).json( {message: "Manufacturing process added" ,newServiceManufacture});
      }

      
  } catch (error) {
      console.error("Error fetching journal:", error);
      res.status(500).json({ message: "Internal server error." });
  }
};















// Validate Organization Tax Currency
function validateOrganizationTaxCurrency( organizationExists, customerExist, existingPrefix, defaultAccount, res ) {
    if (!organizationExists) {
      res.status(404).json({ message: "Organization not found" });
      return false;
    }
    if (!customerExist) {
      res.status(404).json({ message: "Customer not found" });
      return false;
    }
    if (!existingPrefix) {
      res.status(404).json({ message: "Prefix not found" });
      return false;
    }
    if (!defaultAccount) {
      res.status(404).json({ message: "Setup Accounts in settings" });
      return false;
    }
    return true;
  }
    


//Validate inputs
function validateInputs( cleanedData, customerExist, defaultAccount, allData, res) {
    const validationErrors = validateOrderData( cleanedData, customerExist, defaultAccount, allData  );


  
    if (validationErrors.length > 0) {
      res.status(400).json({ message: validationErrors.join(", ") });
      return false;
    }
    return true;
 }



//Validate Data
function validateOrderData( data, customerExist, defaultAccount, allData ) {
    const errors = [];    
  
    //Basic Info
    validateReqFields( data, customerExist, defaultAccount, errors );
    validateService( data.service, allData, errors);
  
  
  
  
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
function validateReqFields( data, customerExist, defaultAccount, errors ) {

    validateField( typeof data.customerId === 'undefined', "Please select a Customer", errors  );
    validateField( typeof data.placeOfSupply === 'undefined', "Place of supply required", errors  );
    validateField( typeof data.saleOrderDate === 'undefined', "Sale Order Date required", errors  );
       
    validateField( typeof data.roundOffAmount !== 'undefined' && !( Number(data.roundOffAmount) >= 0 && Number(data.roundOffAmount) <= 1), "Round Off Amount must be between 0 and 1", errors );
    
    validateField( typeof data.paidAmount !== 'undefined' && ( Number(data.paidAmount) > Number(data.totalAmount)), "Excess payment amount", errors );
    validateField( typeof data.paidAmount !== 'undefined' && ( Number(data.paidAmount) < 0 ), "Negative payment amount", errors );
    
    validateField( typeof defaultAccount.salesDiscountAccount === 'undefined', "No Sales Discount Account found", errors  );
    
    validateField( customerExist.taxType === 'GST' && typeof defaultAccount.outputCgst === 'undefined', "No Output Cgst Account found", errors  );
    validateField( customerExist.taxType === 'GST' && typeof defaultAccount.outputSgst === 'undefined', "No Output Sgst Account found", errors  );
    validateField( customerExist.taxType === 'GST' && typeof defaultAccount.outputIgst === 'undefined', "No Output Igst Account found", errors  );
    validateField( customerExist.taxType === 'VAT' && typeof defaultAccount.outputVat === 'undefined', "No Output Vat Account found", errors  );
    
}







// Function to Validate Item Table 
function validateService(data, allData, errors) {
  
    const { allParameter, allFabrics, allRawMaterial, allStyle, services } = allData;

    // Check for service count mismatch
    validateField(data.length !== services.length, "Mismatch in service count between request and database.", errors);

    // Iterate through each service to validate individual fields
    data.forEach((svc, svcIndex) => {
        const fetchedService = services.find(s => s._id.toString() === svc.serviceId.toString());

        // Check if service exists in the service table
        validateField(!fetchedService, `Service with ID ${svc.serviceId} was not found.`, errors);
        if (!fetchedService) return;


        // Validate individual service fields

        // validateField(svc.serviceCharge !== fetchedService.serviceCharge, `Service rate mismatch for service ${svc.serviceName}: ${svc.serviceCharge}`, errors);
        validateField( typeof svc.serviceName === 'undefined', "Please select a valid service", errors  );
        validateField( typeof svc.cgst === 'undefined', "CGST required", errors  );
        validateField( typeof svc.sgst === 'undefined', "SGST required", errors  );
        validateField( typeof svc.igst === 'undefined', "IGST required", errors  );
        validateField( typeof svc.taxRate === 'undefined', "Tax Rate required", errors  );
        validateField( typeof svc.serviceRate === 'undefined', "Service Rate required", errors  );
        validateField( typeof svc.serviceTax === 'undefined', "Service Tax required", errors  );
        validateField( typeof svc.fabricRate === 'undefined', "Fabric Rate required", errors  );
        validateField( typeof svc.fabricTax === 'undefined', "Fabric Tax required", errors  );
        validateField( typeof svc.rawMaterialRate === 'undefined', "Raw Material Rate required", errors  );
        validateField( typeof svc.rawMaterialTax === 'undefined', "Raw Material Tax required", errors  );
        validateField( typeof svc.styleRate === 'undefined', "Style Rate required", errors  );
        validateField( typeof svc.styleTax === 'undefined', "Style Tax required", errors  );
        validateField( typeof svc.totalRate === 'undefined', "Total Rate required", errors  );
        validateField( typeof svc.totalTax === 'undefined', "Total Tax required", errors  );
        validateField( typeof svc.itemTotal === 'undefined', "Item Total required", errors  );
        validateField( typeof svc.status === 'undefined', "Status required", errors  );
        validateField( typeof svc.salesAccountId === 'undefined', `Sales Account required for ${svc.serviceName}`, errors  );
        


        validateField(svc.taxRate !== fetchedService.taxRate, `Service tax rate mismatch for service ${svc.serviceName}: ${svc.taxRate}`, errors);
        validateField( svc.cgst !== undefined && fetchedService.cgst !== undefined && Number(svc.cgst) !== Number(fetchedService.cgst), `Service cgst mismatch for service ${svc.serviceName}: ${svc.cgst} ${fetchedService.cgst}`, errors );
        validateField( svc.sgst !== undefined && fetchedService.sgst !== undefined && Number(svc.sgst) !== Number(fetchedService.sgst), `Service sgst mismatch for service ${svc.serviceName}: ${svc.sgst} ${fetchedService.sgst}`, errors );
        validateField( svc.igst !== undefined && fetchedService.igst !== undefined && Number(svc.igst) !== Number(fetchedService.igst), `Service igst mismatch for service ${svc.serviceName}: ${svc.igst} ${fetchedService.igst}`, errors );
        validateField( svc.vat !== undefined && fetchedService.vat !== undefined && Number(svc.vat) !== Number(fetchedService.vat), `Service vat mismatch for service ${svc.serviceName}: ${svc.vat} ${fetchedService.vat}`, errors );
        validateField( svc.salesAccountId.toString() !== fetchedService.salesAccountId.toString(), `Sales Account mismatch for service ${svc.serviceName}: ${svc.salesAccountId} ${fetchedService.salesAccountId}`, errors );

      



        // Validate fabrics within the service
        svc.fabric.forEach((fabric) => {
            const fetchedFabric = allFabrics.find(f => f._id.toString() === fabric.itemId.toString());

            // Check if fabric exists in the fabric table
            validateField(!fetchedFabric, `Fabric with ID ${fabric.itemId} was not found.`, errors);
            if (!fetchedFabric) return;
           

            // Validate individual fabric fields

            validateField( typeof fabric.itemName === 'undefined', "Please select a valid fabric", errors  );
            validateField( typeof fabric.quantity === 'undefined', "Quantity required", errors  );
            validateField( typeof fabric.sellingPrice === 'undefined', "Selling Price required", errors  );
            validateField( typeof fabric.taxPreference === 'undefined', "Tax Preference required", errors  );
            validateField( typeof fabric.taxRate === 'undefined', "Fabric Tax required", errors  );
            validateField( typeof fabric.itemTotalTax === 'undefined', "Item Total Tax required", errors  );
            validateField( typeof fabric.itemAmount === 'undefined', "Item Amount required", errors  );
            validateField( typeof fabric.salesAccountId === 'undefined', `Sales Amount required for ${fabric.itemName}`, errors  );


            // validateField(fabric.sellingPrice !== fetchedFabric.sellingPrice, `Selling price mismatch for fabric ${fabric.itemName}: ${fabric.sellingPrice}`, errors);
            validateField(fabric.taxPreference !== fetchedFabric.taxPreference, `Tax preference mismatch for fabric ${fabric.itemName}: ${fabric.taxPreference}`, errors);
            validateField(fabric.taxRate !== fetchedFabric.taxRate, `Tax rate mismatch for fabric ${fabric.itemName}: ${fabric.taxRate}`, errors);
            validateField( svc.cgst !== undefined && fetchedService.cgst !== undefined && Number(fabric.cgst) !== Number(fetchedFabric.cgst), `CGST mismatch for fabric ${fabric.itemName}: ${fabric.cgst}`, errors);
            validateField( svc.sgst !== undefined && fetchedService.sgst !== undefined && Number(fabric.sgst) !== Number(fetchedFabric.sgst), `SGST mismatch for fabric ${fabric.itemName}: ${fabric.sgst}`, errors);
            validateField( svc.igst !== undefined && fetchedService.igst !== undefined && Number(fabric.igst) !== Number(fetchedFabric.igst), `IGST mismatch for fabric ${fabric.itemName}: ${fabric.igst}`, errors);
            validateField( svc.vat !== undefined && fetchedService.vat !== undefined && Number(fabric.vat) !== Number(fetchedFabric.vat), `VAT mismatch for fabric ${fabric.itemName}: ${fabric.vat}`, errors);
            validateField( fabric.salesAccountId.toString() !== fetchedFabric.salesAccountId.toString(), `Sales Account mismatch for fabric ${fabric.itemName}`, errors);

        });





        // Validate raw material within the service
        svc.rawMaterial.forEach((rawMaterial) => {
          const fetchedRawMaterial = allRawMaterial.find(f => f._id.toString() === rawMaterial.itemId.toString());

          // Check if raw material exists in the raw material table
          validateField(!fetchedRawMaterial, `Raw Material with ID ${rawMaterial.itemId} was not found.`, errors);
          if (!fetchedRawMaterial) return;
         

          // Validate individual raw material fields
          validateField( typeof rawMaterial.itemName === 'undefined', "Please select a valid Raw Material", errors  );
          validateField( typeof rawMaterial.quantity === 'undefined', "Quantity required", errors  );
          validateField( typeof rawMaterial.sellingPrice === 'undefined', "Selling Price required", errors  );
          validateField( typeof rawMaterial.taxPreference === 'undefined', "Tax Preference required", errors  );
          validateField( typeof rawMaterial.taxRate === 'undefined', "Raw Material Tax required", errors  );
          validateField( typeof rawMaterial.itemTotalTax === 'undefined', "Item Total Tax required", errors  );
          validateField( typeof rawMaterial.itemAmount === 'undefined', "Item Amount required", errors  );
          validateField( typeof rawMaterial.salesAccountId === 'undefined', `Sales Amount required for ${rawMaterial.itemName}`, errors  );


          // validateField(rawMaterial.sellingPrice !== fetchedRawMaterial.sellingPrice, `Selling price mismatch for raw material ${rawMaterial.itemName}: ${rawMaterial.sellingPrice}`, errors);
          validateField(rawMaterial.taxPreference !== fetchedRawMaterial.taxPreference, `Tax preference mismatch for raw material ${rawMaterial.itemName}: ${rawMaterial.taxPreference}`, errors);
          validateField(rawMaterial.taxRate !== fetchedRawMaterial.taxRate, `Tax rate mismatch for raw material ${rawMaterial.itemName}: ${rawMaterial.taxRate}`, errors);
          validateField( svc.cgst !== undefined && fetchedService.cgst !== undefined && Number(rawMaterial.cgst) !== Number(fetchedRawMaterial.cgst), `CGST mismatch for raw material ${rawMaterial.itemName}: ${rawMaterial.cgst}`, errors);
          validateField( svc.sgst !== undefined && fetchedService.sgst !== undefined && Number(rawMaterial.sgst) !== Number(fetchedRawMaterial.sgst), `SGST mismatch for raw material ${rawMaterial.itemName}: ${rawMaterial.sgst}`, errors);
          validateField( svc.igst !== undefined && fetchedService.igst !== undefined && Number(rawMaterial.igst) !== Number(fetchedRawMaterial.igst), `IGST mismatch for raw material ${rawMaterial.itemName}: ${rawMaterial.igst}`, errors);
          validateField( svc.vat !== undefined && fetchedService.vat !== undefined && Number(rawMaterial.vat) !== Number(fetchedRawMaterial.vat), `VAT mismatch for raw material ${rawMaterial.itemName}: ${rawMaterial.vat}`, errors);
          validateField( rawMaterial.salesAccountId.toString() !== fetchedRawMaterial.salesAccountId.toString(), `Sales Account mismatch for raw material ${rawMaterial.itemName}`, errors);

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
            validateField( typeof style.styleRate === 'undefined', "Selling Rate required", errors );
            validateField( typeof style.taxRate === 'undefined', "Style Tax required", errors  );
            validateField( typeof style.styleTax === 'undefined', "Style Total Tax required", errors );
            validateField( typeof style.styleAmount === 'undefined', "Style Amount required", errors  );

            validateField(style.taxRate !== svc.taxRate, `Tax rate mismatch for style ${style.styleName}: ${style.taxRate}`, errors);    
            validateField( style.cgst !== undefined && svc.cgst !== undefined && Number(style.cgst) !== Number(svc.cgst), `CGST mismatch for style ${style.styleName}: ${style.cgst}`, errors);
            validateField( style.sgst !== undefined && svc.sgst !== undefined && Number(style.sgst) !== Number(svc.sgst), `SGST mismatch for style ${style.styleName}: ${style.sgst}`, errors);
            validateField( style.igst !== undefined && svc.igst !== undefined && Number(style.igst) !== Number(svc.igst), `IGST mismatch for style ${style.styleName}: ${style.igst}`, errors);
            validateField( style.vat !== undefined && svc.vat !== undefined && Number(style.vat) !== Number(svc.vat), `VAT mismatch for style ${style.styleName}: ${style.vat}`, errors);



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







// Tax Type
function taxType( cleanedData, customerExist, organizationExists ) {  
    if(customerExist.taxType === 'GST' ){
      if(cleanedData.placeOfSupply === organizationExists.state){
        cleanedData.taxType ='Intra';
      }
      else{
        cleanedData.taxType ='Inter';
      }
    }
    if(customerExist.taxType === 'VAT' ){
      cleanedData.taxType ='VAT';
    }
    if(customerExist.taxType === 'Non-Tax' ){
      cleanedData.taxType ='Non-Tax';
    }
  }





//Default Account
async function defaultAccounting( data, defaultAccount, organizationExists, organizationId) {
  // 1. Fetch required accounts
  const accounts = await accDataExists( 
    organizationId, 
    data.otherExpenseAccountId, 
    data.freightAccountId, 
    data.depositAccountId
  );

  console.log( accounts );
  
  
  // 2. Check for missing required accounts
  const errorMessage = getMissingAccountsError(data, defaultAccount, accounts);
  if (errorMessage) {
    return { defAcc: null, error: errorMessage };
  }

  // 3. Update account references
  assignAccountReferences(data, defaultAccount, accounts);
  
  return { defAcc: defaultAccount, error: null };
}

function getMissingAccountsError(data, defaultAccount, accounts) {  
  const accountChecks = [
    // Tax account checks
    { condition: data.cgst, account: defaultAccount.outputCgst, message: "CGST Account" },
    { condition: data.sgst, account: defaultAccount.outputSgst, message: "SGST Account" },
    { condition: data.igst, account: defaultAccount.outputIgst, message: "IGST Account" },
    { condition: data.vat, account: defaultAccount.outputVat, message: "VAT Account" },
    
    // Transaction account checks
    { condition: data.totalDiscount, account: defaultAccount.salesDiscountAccount, message: "Discount Account" },
    { condition: data.otherExpenseAmount, account: accounts.otherExpenseAcc, message: "Other Expense Account" },
    { condition: data.freightAmount, account: accounts.freightAcc, message: "Freight Account" },
    { condition: data.paidAmount, account: accounts.depositAcc, message: "Deposit Account" }
  ];

  const missingAccounts = accountChecks
    .filter(({ condition, account }) => condition && !account)
    .map(({ message }) => `${message} not found`);

  return missingAccounts.length ? missingAccounts.join(". ") : null;
}

function assignAccountReferences(data, defaultAccount, accounts) {
  if (data.otherExpenseAmount) {
    defaultAccount.otherExpenseAccountId = accounts.otherExpenseAcc?._id;
  }
  if (data.freightAmount) {
    defaultAccount.freightAccountId = accounts.freightAcc?._id;
  }
  if (data.paidAmount) {
    defaultAccount.depositAccountId = accounts.depositAcc?._id;
  }
}





function calculateSalesOrder(cleanedData, res) {
  const errors = [];
  let totalAmount = 0;
  let subTotal = 0;
  let totalTax = 0;
  let saleAmount = 0; 
  let totalDiscount = 0;
  let totalItemCount = 0;
  let totalServiceCount = 0;

  // Utility function to round values to two decimal places
  const roundToTwoDecimals = (value) => Number(value.toFixed(2));

  // Utility function to convert values to numbers for comparison
  const toNumber = (value) => Number(value);

  cleanedData.service.forEach(service => {
      totalServiceCount += 1;

      let fabricRate = 0;
      let fabricTax = 0;
      
      let styleRate = 0;
      let styleTax = 0;
      
      let rawMaterialRate = 0;
      let rawMaterialTax = 0;



      // Checking fabric items
      service.fabric.forEach(item => {
          let calculatedCgstAmount = 0;
          let calculatedSgstAmount = 0;
          let calculatedIgstAmount = 0;
          let calculatedVatAmount = 0;
          let calculatedTaxAmount = 0;
          let taxType = cleanedData.taxType;

          // Calculate item line discount 
          const discountAmount = calculateDiscount(item);

          totalDiscount += toNumber(discountAmount);
          totalItemCount += toNumber(item.quantity);

          let itemTotal = (toNumber(item.sellingPrice) * toNumber(item.quantity)) - toNumber(discountAmount);
          saleAmount += (toNumber(item.sellingPrice) * toNumber(item.quantity));
          fabricRate += itemTotal; 
          

          // Handle tax calculation only for taxable items
          if (item.taxPreference.trim() === 'Taxable') {            
              switch (taxType) {
                  case 'Intra':
                      calculatedCgstAmount = roundToTwoDecimals((toNumber(item.cgst) / 100) * itemTotal);
                      calculatedSgstAmount = roundToTwoDecimals((toNumber(item.sgst) / 100) * itemTotal);
                      itemTotal += calculatedCgstAmount + calculatedSgstAmount;
                      break;

                  case 'Inter':
                      calculatedIgstAmount = roundToTwoDecimals((toNumber(item.igst) / 100) * itemTotal);
                      itemTotal += calculatedIgstAmount;
                      break;

                  case 'VAT':
                      calculatedVatAmount = roundToTwoDecimals((toNumber(item.vat) / 100) * itemTotal);
                      itemTotal += calculatedVatAmount;
                      break;
              }

              calculatedTaxAmount = calculatedCgstAmount + calculatedSgstAmount + calculatedIgstAmount + calculatedVatAmount;

              // Check tax amounts
              checkAmount(calculatedCgstAmount, toNumber(item.cgstAmount), item.itemName, 'CGST', errors);
              checkAmount(calculatedSgstAmount, toNumber(item.sgstAmount), item.itemName, 'SGST', errors);
              checkAmount(calculatedIgstAmount, toNumber(item.igstAmount), item.itemName, 'IGST', errors);
              checkAmount(calculatedVatAmount, toNumber(item.vatAmount), item.itemName, 'VAT', errors);
              checkAmount(calculatedTaxAmount, toNumber(item.itemTotalTax), item.itemName, 'Total tax', errors);

              totalTax += calculatedCgstAmount + calculatedSgstAmount + calculatedIgstAmount + calculatedVatAmount || 0;
              fabricTax += calculatedCgstAmount + calculatedSgstAmount + calculatedIgstAmount + calculatedVatAmount || 0;
              
          } else {
              console.log(`Skipping Tax for Non-Taxable item: ${item.itemName}`);
              console.log(`Item: ${item.itemName}, Calculated Discount: ${totalDiscount}`);
          }

          // Update total values
          subTotal += toNumber(itemTotal);

          checkAmount(itemTotal, toNumber(item.itemAmount), item.itemName, 'Item Total', errors);

          console.log(`${item.itemName} Item Total: ${itemTotal} , Provided ${item.itemAmount}`);
          console.log(`${item.itemName} Total Tax: ${calculatedTaxAmount} , Provided ${item.itemTotalTax || 0}`);
          console.log("");
      });



      // Checking raw material items
      service.rawMaterial.forEach(item => {
        let calculatedCgstAmount = 0;
        let calculatedSgstAmount = 0;
        let calculatedIgstAmount = 0;
        let calculatedVatAmount = 0;
        let calculatedTaxAmount = 0;
        let taxType = cleanedData.taxType;

        // Calculate item line discount 
        const discountAmount = calculateDiscount(item);

        totalDiscount += toNumber(discountAmount);
        totalItemCount += toNumber(item.quantity);

        let itemTotal = (toNumber(item.sellingPrice) * toNumber(item.quantity)) - toNumber(discountAmount);
        saleAmount += (toNumber(item.sellingPrice) * toNumber(item.quantity));
        rawMaterialRate += itemTotal; 
        

        // Handle tax calculation only for taxable items
        if (item.taxPreference.trim() === 'Taxable') {            
            switch (taxType) {
                case 'Intra':
                    calculatedCgstAmount = roundToTwoDecimals((toNumber(item.cgst) / 100) * itemTotal);
                    calculatedSgstAmount = roundToTwoDecimals((toNumber(item.sgst) / 100) * itemTotal);
                    itemTotal += calculatedCgstAmount + calculatedSgstAmount;
                    break;

                case 'Inter':
                    calculatedIgstAmount = roundToTwoDecimals((toNumber(item.igst) / 100) * itemTotal);
                    itemTotal += calculatedIgstAmount;
                    break;

                case 'VAT':
                    calculatedVatAmount = roundToTwoDecimals((toNumber(item.vat) / 100) * itemTotal);
                    itemTotal += calculatedVatAmount;
                    break;
            }

            calculatedTaxAmount = calculatedCgstAmount + calculatedSgstAmount + calculatedIgstAmount + calculatedVatAmount;

            // Check tax amounts
            checkAmount(calculatedCgstAmount, toNumber(item.cgstAmount), item.itemName, 'CGST', errors);
            checkAmount(calculatedSgstAmount, toNumber(item.sgstAmount), item.itemName, 'SGST', errors);
            checkAmount(calculatedIgstAmount, toNumber(item.igstAmount), item.itemName, 'IGST', errors);
            checkAmount(calculatedVatAmount, toNumber(item.vatAmount), item.itemName, 'VAT', errors);
            checkAmount(calculatedTaxAmount, toNumber(item.itemTotalTax), item.itemName, 'Total tax', errors);

            totalTax += calculatedCgstAmount + calculatedSgstAmount + calculatedIgstAmount + calculatedVatAmount || 0;
            rawMaterialTax += calculatedCgstAmount + calculatedSgstAmount + calculatedIgstAmount + calculatedVatAmount || 0;
            
        } else {
            console.log(`Skipping Tax for Non-Taxable item: ${item.itemName}`);
            console.log(`Item: ${item.itemName}, Calculated Discount: ${totalDiscount}`);
        }

        // Update total values
        subTotal += toNumber(itemTotal);

        checkAmount(itemTotal, toNumber(item.itemAmount), item.itemName, 'Item Total', errors);

        console.log(`${item.itemName} Item Total: ${itemTotal} , Provided ${item.itemAmount}`);
        console.log(`${item.itemName} Total Tax: ${calculatedTaxAmount} , Provided ${item.itemTotalTax || 0}`);
        console.log("");
    });

      // Checking style rates
      service.style.forEach(style => {
          let calculatedCgstAmount = 0;
          let calculatedSgstAmount = 0;
          let calculatedIgstAmount = 0;
          let calculatedVatAmount = 0;
          let calculatedTaxAmount = 0;
          let taxType = cleanedData.taxType;

          let styleTotal = toNumber(style.styleRate);
          saleAmount += styleTotal;
          styleRate += styleTotal;

          // Handle tax calculation only for taxable styles
          if (service.taxRate) {
              switch (taxType) {
                  case 'Intra':
                      calculatedCgstAmount = roundToTwoDecimals((toNumber(style.cgst) / 100) * styleTotal);
                      calculatedSgstAmount = roundToTwoDecimals((toNumber(style.sgst) / 100) * styleTotal);
                      styleTotal += calculatedCgstAmount + calculatedSgstAmount;
                      break;

                  case 'Inter':
                      calculatedIgstAmount = roundToTwoDecimals((toNumber(style.igst) / 100) * styleTotal);
                      styleTotal += calculatedIgstAmount;
                      break;

                  case 'VAT':
                      calculatedVatAmount = roundToTwoDecimals((toNumber(style.vat) / 100) * styleTotal);
                      styleTotal += calculatedVatAmount;
                      break;
              }
              calculatedTaxAmount = calculatedCgstAmount + calculatedSgstAmount + calculatedIgstAmount + calculatedVatAmount;

              // Check tax amounts
              checkAmount(calculatedCgstAmount, toNumber(style.cgstAmount), `Style ${style.styleName}`, 'CGST', errors);
              checkAmount(calculatedSgstAmount, toNumber(style.sgstAmount), `Style ${style.styleName}`, 'SGST', errors);
              checkAmount(calculatedIgstAmount, toNumber(style.igstAmount), `Style ${style.styleName}`, 'IGST', errors);
              checkAmount(calculatedVatAmount, toNumber(style.vatAmount), `Style ${style.styleName}`, 'VAT', errors);
              checkAmount(calculatedTaxAmount, toNumber(style.styleTax), `Style ${style.styleName}`, 'Total tax', errors);
              
              totalTax += calculatedCgstAmount + calculatedSgstAmount + calculatedIgstAmount + calculatedVatAmount || 0;
              styleTax += calculatedCgstAmount + calculatedSgstAmount + calculatedIgstAmount + calculatedVatAmount || 0;
            }else{
              console.log(`Skipping Tax for Non-Taxable style: ${style.styleName}`);
            }
            
            // Update total values
            subTotal += toNumber(styleTotal);
            
            checkAmount(styleTotal, toNumber(style.styleAmount), `Style ${style.styleName}`, 'Style Total', errors);
            console.log("  ");
      });

      // Checking service rates
      let serviceTotal = toNumber(service.serviceRate);
      saleAmount += serviceTotal; // Accumulate final amount without tax

      // Handle tax calculation only for taxable services

          let calculatedCgstAmount = 0;
          let calculatedSgstAmount = 0;
          let calculatedIgstAmount = 0;
          let calculatedVatAmount = 0;
          let calculatedTaxAmount = 0;
          let taxType = cleanedData.taxType;

          switch (taxType) {
              case 'Intra':
                  calculatedCgstAmount = roundToTwoDecimals((toNumber(service.cgst) / 100) * serviceTotal);
                  calculatedSgstAmount = roundToTwoDecimals((toNumber(service.sgst) / 100) * serviceTotal);
                  serviceTotal += calculatedCgstAmount + calculatedSgstAmount;
                  break;

              case 'Inter':
                  calculatedIgstAmount = roundToTwoDecimals((toNumber(service.igst) / 100) * serviceTotal);
                  serviceTotal += calculatedIgstAmount;
                  break;

              case 'VAT':
                  calculatedVatAmount = roundToTwoDecimals((toNumber(service.vat) / 100) * serviceTotal);
                  serviceTotal += calculatedVatAmount;
                  break;
          }
          calculatedTaxAmount = calculatedCgstAmount + calculatedSgstAmount + calculatedIgstAmount + calculatedVatAmount;          

          // Check tax amounts
          checkAmount(calculatedCgstAmount, toNumber(service.cgstService), service.serviceName, 'CGST', errors);
          checkAmount(calculatedSgstAmount, toNumber(service.sgstService), service.serviceName, 'SGST', errors);
          checkAmount(calculatedIgstAmount, toNumber(service.igstService), service.serviceName, 'IGST', errors);
          checkAmount(calculatedVatAmount, toNumber(service.vatService), service.serviceName, 'VAT', errors);
          checkAmount(calculatedTaxAmount, toNumber(service.serviceTax), service.serviceName, 'Total tax', errors);

          // Add to total tax
          totalTax += calculatedCgstAmount + calculatedSgstAmount + calculatedIgstAmount + calculatedVatAmount || 0;
      

      // Update total values
      subTotal += toNumber(serviceTotal);

      console.log("  ");
      checkAmount(serviceTotal, toNumber(service.serviceAmount), service.serviceName, 'Service Total', errors);
      
      checkAmount(fabricRate, toNumber(service.fabricRate), service.serviceName, 'Fabric Rate', errors);
      checkAmount(fabricTax, toNumber(service.fabricTax), service.serviceName, 'Fabric Tax', errors);
      
      checkAmount(styleRate, toNumber(service.styleRate), service.serviceName, 'Style Rate', errors);
      checkAmount(styleTax, toNumber(service.styleTax), service.serviceName, 'Style Tax', errors);

      checkAmount(rawMaterialRate, toNumber(service.rawMaterialRate), service.serviceName, 'Raw Material Rate', errors);
      checkAmount(rawMaterialTax, toNumber(service.rawMaterialTax), service.serviceName, 'Raw Material Tax', errors);
  });

  // Sale amount
  cleanedData.saleAmount = saleAmount;

  console.log("Sale Amount: ", saleAmount); // Log the final amount without tax

  console.log(`SubTotal: ${subTotal} , Provided ${cleanedData.subTotal}`);

  // Other Expense
  totalAmount = otherExpense(subTotal, cleanedData);
  console.log("Total Amount After Other Expense: ", totalAmount);

  // Transaction Discount
  let transactionDiscount = calculateTransactionDiscount(cleanedData, totalAmount);

  totalDiscount += toNumber(transactionDiscount);

  // Total amount calculation
  totalAmount -= transactionDiscount;

  // Balance amount
  cleanedData.balanceAmount = totalAmount - (toNumber(cleanedData.paidAmount) || 0);

  // Round the totals for comparison
  const roundedSubTotal = roundToTwoDecimals(subTotal);
  const roundedTotalTax = roundToTwoDecimals(totalTax);
  const roundedTotalAmount = roundToTwoDecimals(totalAmount);
  const roundedTotalDiscount = roundToTwoDecimals(totalDiscount);

  console.log(`Final Sub Total: ${roundedSubTotal} , Provided ${toNumber(cleanedData.subTotal)}`);
  console.log(`Final Total Tax: ${roundedTotalTax} , Provided ${toNumber(cleanedData.totalTax)}`);
  console.log(`Final Total Amount: ${roundedTotalAmount} , Provided ${toNumber(cleanedData.totalAmount)}`);
  console.log(`Final Total Discount Amount: ${roundedTotalDiscount} , Provided ${toNumber(cleanedData.totalDiscount)}`);

  validateAmount(roundedSubTotal, toNumber(cleanedData.subTotal), 'SubTotal', errors);
  validateAmount(roundedTotalTax, toNumber(cleanedData.totalTax), 'Total Tax', errors);
  validateAmount(roundedTotalAmount, toNumber(cleanedData.totalAmount), 'Total Amount', errors);
  validateAmount(roundedTotalDiscount, toNumber(cleanedData.totalDiscount), 'Total Discount Amount', errors);
  validateAmount(totalServiceCount, toNumber(cleanedData.totalService), 'Total Item count', errors);

  // Validate serviceRate, serviceTax, fabricRate, fabricTax, styleRate, styleTax
  validateAmount(saleAmount, toNumber(cleanedData.saleAmount), 'Sale Amount', errors);
  validateAmount(totalTax, toNumber(cleanedData.totalTax), 'Total Tax', errors);



  if (errors.length > 0) {
      res.status(400).json({ message: errors.join(", ") });
      return false;
  }

  return true;
}


// Calculate item discount
function calculateDiscount(item) {
    return item.discountType === 'Currency'
      ? item.discountAmount || 0
      : (item.sellingPrice * item.quantity * (item.discountAmount || 0)) / 100;
  }


//Mismatch Check
function checkAmount(calculatedAmount, providedAmount , itemName, taxType,errors) {  

    providedAmount = providedAmount ?? 0; 
    
    const roundToTwoDecimals = (value) => Number(value.toFixed(2)); // Round to two decimal places
    const roundedAmount = roundToTwoDecimals( Number(calculatedAmount) );
    console.log(`Item: ${itemName}, Calculated ${taxType}: ${roundedAmount}, Provided data: ${providedAmount}`);
  
    
    if (Math.abs(roundedAmount - providedAmount) > 0.01) {
      const errorMessage = `Mismatch in ${taxType} for item ${itemName}: Calculated ${calculatedAmount}, Provided ${providedAmount}`;
      errors.push(errorMessage);
      console.log(errorMessage);
    }
  }


const otherExpense = ( totalAmount, cleanedData ) => {
  if (cleanedData.otherExpenseAmount) {
    const parsedAmount = parseFloat(cleanedData.otherExpenseAmount);
    totalAmount += parsedAmount;
    console.log(`Other Expense: ${cleanedData.otherExpenseAmount}`);
  }
  if (cleanedData.freightAmount) {
    const parsedAmount = parseFloat(cleanedData.freightAmount);
    totalAmount += parsedAmount;
    console.log(`Freight Amount: ${cleanedData.freightAmount}`);
  }
  if (cleanedData.roundOffAmount) {
    const parsedAmount = parseFloat(cleanedData.roundOffAmount);
    totalAmount -= parsedAmount;
    console.log(`Round Off Amount: ${cleanedData.roundOffAmount}`);
  }
  return totalAmount;  
};



//TransactionDiscount
function calculateTransactionDiscount(cleanedData, totalAmount) {
    const discountAmount = cleanedData.discountTransactionAmount || 0;
  
    return cleanedData.discountTransactionType === 'Currency'
      ? discountAmount
      : (totalAmount * discountAmount) / 100;
  }

//Final Item Amount check
const validateAmount = (calculatedValue, cleanedValue, label, errors) => {
    const isCorrect = calculatedValue === parseFloat(cleanedValue);
    if (!isCorrect) {
      const errorMessage = `${label} is incorrect: ${cleanedValue} instead of ${calculatedValue}`;
      errors.push(errorMessage);
      console.log(errorMessage);
    }
  };




function salesJournal(cleanedData, res) {
  const errors = [];
  const roundToTwoDecimals = (value) => Number(value.toFixed(2));
  const accountEntries = {};
  // Iterate through each service
  cleanedData.service.forEach(service => {
      const serviceSalesAccountId = service.salesAccountId;
      if (!serviceSalesAccountId) {
          errors.push({ message: `Sales Account not found for service ${service.serviceName}` });
          return;
      }
      // Calculate and accumulate Service Rate (excluding tax)
      const serviceRate = roundToTwoDecimals(parseFloat(service.serviceRate || 0));
      if (!accountEntries[serviceSalesAccountId]) {
          accountEntries[serviceSalesAccountId] = { accountId: serviceSalesAccountId, creditAmount: 0 };
      }
      accountEntries[serviceSalesAccountId].creditAmount += serviceRate;
      // Add Style Rate (excluding tax) to Service Sales Account
      service.style?.forEach(style => {
          const styleRate = roundToTwoDecimals(parseFloat(style.styleRate || 0));
          accountEntries[serviceSalesAccountId].creditAmount += styleRate;
      });
      // Iterate through fabrics
      service.fabric?.forEach(fabric => {
          const fabricSalesAccountId = fabric.salesAccountId;
          if (!fabricSalesAccountId) {
              errors.push({ message: `Sales Account not found for fabric ${fabric.itemName}` });
              return;
          }
          // Calculate fabric amount excluding tax
          const fabricRate = roundToTwoDecimals(parseFloat(fabric.sellingPrice || 0) * parseInt(fabric.quantity || 0));
          
          if (!accountEntries[fabricSalesAccountId]) {
              accountEntries[fabricSalesAccountId] = { accountId: fabricSalesAccountId, creditAmount: 0 };
          }
          accountEntries[fabricSalesAccountId].creditAmount += fabricRate;
      });
      // Iterate through fabrics
      service.rawMaterial?.forEach(rawMaterial => {
        const rawMaterialSalesAccountId = rawMaterial.salesAccountId;
        if (!rawMaterialSalesAccountId) {
            errors.push({ message: `Sales Account not found for fabric ${rawMaterial.itemName}` });
            return;
        }
        // Calculate fabric amount excluding tax
        const rawMaterialRate = roundToTwoDecimals(parseFloat(rawMaterial.sellingPrice || 0) * parseInt(rawMaterial.quantity || 0));
        
        if (!accountEntries[rawMaterialSalesAccountId]) {
            accountEntries[rawMaterialSalesAccountId] = { accountId: rawMaterialSalesAccountId, creditAmount: 0 };
        }
        accountEntries[rawMaterialSalesAccountId].creditAmount += rawMaterialRate;
    });
  });
  // Store results
  cleanedData.salesJournal = Object.values(accountEntries);
  if (errors.length > 0) {
      res.status(400).json({ success: false, message: "Sales journal error", errors });
      return false;
  }
  return true;
}





// Sales Prefix
function salesOrderPrefix( cleanData, existingPrefix ) {
  const activeSeries = existingPrefix.series.find(series => series.status === true);
  if (!activeSeries) {
    return res.status(404).json({ message: "No active series found for the organization." });
  }
  cleanData.salesOrder = `${activeSeries.salesOrder}${activeSeries.salesOrderNum}`;

  activeSeries.salesOrderNum += 1;

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












async function journal( savedOrder, defAcc, customerAccount ) {  
  const discount = {
    organizationId: savedOrder.organizationId,
    operationId: savedOrder._id,
    transactionId: savedOrder.salesOrder,
    date: savedOrder.createdDate,
    accountId: defAcc.salesDiscountAccount || undefined,
    action: "Sales Invoice",
    debitAmount: savedOrder.totalDiscount || 0,
    creditAmount: 0,
    remark: savedOrder.note,
    createdDateTime:savedOrder.createdDateTime
  };
  // const sale = {
  //   organizationId: savedOrder.organizationId,
  //   operationId: savedOrder._id,
  //   transactionId: savedOrder.salesOrder,
  //   date: savedOrder.createdDate,
  //   accountId: defAcc.salesAccount || undefined,
  //   action: "Sales Invoice",
  //   debitAmount: 0,
  //   creditAmount: savedOrder.saleAmount,
  //   remark: savedOrder.note,
  // };
  const cgst = {
    organizationId: savedOrder.organizationId,
    operationId: savedOrder._id,
    transactionId: savedOrder.salesOrder,
    date: savedOrder.createdDate,
    accountId: defAcc.outputCgst || undefined,
    action: "Sales Invoice",
    debitAmount: 0,
    creditAmount: savedOrder.cgst || 0,
    remark: savedOrder.note,
    createdDateTime:savedOrder.createdDateTime
  };
  const sgst = {
    organizationId: savedOrder.organizationId,
    operationId: savedOrder._id,
    transactionId: savedOrder.salesOrder,
    date: savedOrder.createdDate,
    accountId: defAcc.outputSgst || undefined,
    action: "Sales Invoice",
    debitAmount: 0,
    creditAmount: savedOrder.sgst || 0,
    remark: savedOrder.note,
    createdDateTime:savedOrder.createdDateTime
  };
  const igst = {
    organizationId: savedOrder.organizationId,
    operationId: savedOrder._id,
    transactionId: savedOrder.salesOrder,
    date: savedOrder.createdDate,
    accountId: defAcc.outputIgst || undefined,
    action: "Sales Invoice",
    debitAmount: 0,
    creditAmount: savedOrder.igst || 0,
    remark: savedOrder.note,
    createdDateTime:savedOrder.createdDateTime
  };
  const vat = {
    organizationId: savedOrder.organizationId,
    operationId: savedOrder._id,
    transactionId: savedOrder.salesOrder,
    date: savedOrder.createdDate,
    accountId: defAcc.outputVat || undefined,
    action: "Sales Invoice",
    debitAmount: 0,
    creditAmount: savedOrder.vat || 0,
    remark: savedOrder.note,
    createdDateTime:savedOrder.createdDateTime
  };
  const customer = {
    organizationId: savedOrder.organizationId,
    operationId: savedOrder._id,
    transactionId: savedOrder.salesOrder,
    date: savedOrder.createdDate,
    accountId: customerAccount._id || undefined,
    action: "Sales Invoice",
    debitAmount: savedOrder.totalAmount || 0,
    creditAmount: 0,
    remark: savedOrder.note,
    createdDateTime:savedOrder.createdDateTime
  };
  const customerPaid = {
    organizationId: savedOrder.organizationId,
    operationId: savedOrder._id,
    transactionId: savedOrder.salesOrder,
    date: savedOrder.createdDate,
    accountId: customerAccount._id || undefined,
    action: "Receipt",
    debitAmount: 0,
    creditAmount: savedOrder.paidAmount || 0,
    remark: savedOrder.note,
    createdDateTime:savedOrder.createdDateTime
  };
  const depositAccount = {
    organizationId: savedOrder.organizationId,
    operationId: savedOrder._id,
    transactionId: savedOrder.salesOrder,
    date: savedOrder.createdDate,
    accountId: defAcc.depositAccountId || undefined,
    action: "Receipt",
    debitAmount: savedOrder.paidAmount || 0,
    creditAmount: 0,
    remark: savedOrder.note,
    createdDateTime:savedOrder.createdDateTime
  };
  const otherExpense = {
    organizationId: savedOrder.organizationId,
    operationId: savedOrder._id,
    transactionId: savedOrder.salesOrder,
    date: savedOrder.createdDate,
    accountId: defAcc.otherExpenseAccountId || undefined,
    action: "Sales Invoice",
    debitAmount: 0,
    creditAmount: savedOrder.otherExpenseAmount || 0,
    remark: savedOrder.note,
    createdDateTime:savedOrder.createdDateTime
  };
  const freight = {
    organizationId: savedOrder.organizationId,
    operationId: savedOrder._id,
    transactionId: savedOrder.salesOrder,
    date: savedOrder.createdDate,
    accountId: defAcc.freightAccountId || undefined,
    action: "Sales Invoice",
    debitAmount: 0,
    creditAmount: savedOrder.freightAmount || 0,
    remark: savedOrder.note,
    createdDateTime:savedOrder.createdDateTime
  };
  const roundOff = {
    organizationId: savedOrder.organizationId,
    operationId: savedOrder._id,
    transactionId: savedOrder.salesOrder,
    date: savedOrder.createdDate,
    accountName: "Round Off",
    action: "Sales Invoice",
    debitAmount: savedOrder.roundOffAmount || 0,
    creditAmount: 0,
    remark: savedOrder.note,
    createdDateTime:savedOrder.createdDateTime
  };

  let salesTotalDebit = 0;
  let salesTotalCredit = 0;

  if (Array.isArray(savedOrder.salesJournal)) {
    savedOrder.salesJournal.forEach((entry) => {

      console.log( "Account Log",entry.accountId, entry.debitAmount, entry.creditAmount );      

      salesTotalDebit += entry.debitAmount || 0;
      salesTotalCredit += entry.creditAmount || 0;

    });

    console.log("Total Debit Amount from saleJournal:", salesTotalDebit);
    console.log("Total Credit Amount from saleJournal:", salesTotalCredit);
  } else {
    console.error("SaleJournal is not an array or is undefined.");
  }
  


  console.log("cgst", cgst.debitAmount,  cgst.creditAmount);
  console.log("sgst", sgst.debitAmount,  sgst.creditAmount);
  console.log("igst", igst.debitAmount,  igst.creditAmount);
  console.log("vat", vat.debitAmount,  vat.creditAmount);

  console.log("customer", customer.debitAmount,  customer.creditAmount);
  console.log("discount", discount.debitAmount,  discount.creditAmount);

  
  console.log("otherExpense", otherExpense.debitAmount,  otherExpense.creditAmount);
  console.log("freight", freight.debitAmount,  freight.creditAmount);
  console.log("roundOff", roundOff.debitAmount,  roundOff.creditAmount);

  console.log("customerPaid", customerPaid.debitAmount,  customerPaid.creditAmount);
  console.log("depositAccount", depositAccount.debitAmount,  depositAccount.creditAmount);

  const  debitAmount = salesTotalDebit + cgst.debitAmount  + sgst.debitAmount + igst.debitAmount +  vat.debitAmount + customer.debitAmount + discount.debitAmount + otherExpense.debitAmount + freight.debitAmount + roundOff.debitAmount + customerPaid.debitAmount + depositAccount.debitAmount ;
  const  creditAmount = salesTotalCredit + cgst.creditAmount  + sgst.creditAmount + igst.creditAmount +  vat.creditAmount + customer.creditAmount + discount.creditAmount + otherExpense.creditAmount + freight.creditAmount + roundOff.creditAmount + customerPaid.creditAmount + depositAccount.creditAmount ;

  console.log("Total Debit Amount: ", debitAmount );
  console.log("Total Credit Amount: ", creditAmount );

  // console.log( discount, sale, cgst, sgst, igst, vat, customer, otherExpense, freight, roundOff );


  //Sales
    savedOrder.salesJournal.forEach((entry) => {
      const data = {
        organizationId: savedOrder.organizationId,
        operationId: savedOrder._id,
        transactionId: savedOrder.salesOrder,
        date: savedOrder.createdDateTime,
        accountId: entry.accountId || undefined,
        action: "Sales Invoice",
        debitAmount: 0,
        creditAmount: entry.creditAmount || 0,
        remark: savedOrder.note,
        createdDateTime:savedOrder.createdDateTime
      };
      createTrialEntry( data )
    });

    
 



  //Tax
  if(savedOrder.cgst){
    createTrialEntry( cgst )
  }
  if(savedOrder.sgst){
    createTrialEntry( sgst )
  }
  if(savedOrder.igst){
    createTrialEntry( igst )
  }
  if(savedOrder.vat){
    createTrialEntry( vat )
  }

  //Discount  
  if(savedOrder.totalDiscount){
    createTrialEntry( discount )
  }

  //Other Expense
  if(savedOrder.otherExpenseAmount){
    createTrialEntry( otherExpense )
  }

  //Freight
  if(savedOrder.freightAmount){
    createTrialEntry( freight )
  }
  
  //Round Off
  if(savedOrder.roundOffAmount){
    createTrialEntry( roundOff )
  }
 
  //Customer
  createTrialEntry( customer )
  
  //Paid
  if(savedOrder.paidAmount){
    createTrialEntry( customerPaid )
    createTrialEntry( depositAccount )
  }
}





async function createTrialEntry( data ) {
  const newTrialEntry = new TrialBalance({
      organizationId:data.organizationId,
      operationId:data.operationId,
      transactionId: data.transactionId,
      date:data.date,
      accountId: data.accountId,
      action: data.action,
      debitAmount: data.debitAmount,
      creditAmount: data.creditAmount,
      remark: data.remark,
      createdDateTime:data.createdDateTime
});
await newTrialEntry.save();
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
exports.calculation = {
  taxType,
  calculateSalesOrder
};
exports.accounts = {
  defaultAccounting,
  salesJournal,
  journal
};