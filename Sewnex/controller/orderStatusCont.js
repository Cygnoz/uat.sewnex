const Organization = require("../../database/model/organization");

const OrderStatus = require("../model/orderStatus");

const { cleanData } = require("../../services/cleanData");
const { singleCustomDateTime, multiCustomDateTime } = require("../../services/timeConverter");

const mongoose = require('mongoose');
const moment = require("moment-timezone");


// Fetch existing data
const dataExist = async ( organizationId, statusId) => {
    const [organizationExists, allOrderStatus, orderStatus ] = await Promise.all([
      Organization.findOne({ organizationId },{ timeZoneExp: 1, dateFormatExp: 1, dateSplit: 1, organizationCountry: 1 }).lean(),
      OrderStatus.find({ organizationId })
      .lean(),
      OrderStatus.findOne({ organizationId, _id: statusId })
      .lean(),
    ]);
    return { organizationExists, allOrderStatus, orderStatus };
};




// Add Order Status
exports.addOrEditOrderStatus = async (req, res) => {
    console.log("Add or Edit Order Status", req.body);

    try {
        const { organizationId, id: userId } = req.user;
        const cleanedData = cleanData(req.body);

        const { orderServiceId, id: orderStatusId } = cleanedData;

        const { organizationExists } = await dataExist(organizationId, orderStatusId);
        if (!validateOrganization(organizationExists, res)) return;

        // Validate orderServiceId only if creating new
        if (!orderStatusId) {
            if (!mongoose.Types.ObjectId.isValid(orderServiceId) || orderServiceId.length !== 24) {
                return res.status(400).json({ message: `Invalid Order Service ID: ${orderServiceId}` });
            }
        }

        if (!validateInputs(cleanedData, res)) return;

        if (orderStatusId) {
            // -------- Edit flow ----------
            const existingStatus = await OrderStatus.findOne({ _id: orderStatusId, organizationId });

            if (!existingStatus) {
                return res.status(404).json({ message: "Order status not found for update." });
            }

            cleanedData.createdDateTime = moment.tz(cleanedData.saleOrderDate, "YYYY-MM-DDTHH:mm:ss.SSS[Z]", organizationExists.timeZoneExp).toISOString();

            const updatedStatus = await OrderStatus.findByIdAndUpdate(orderStatusId, { ...cleanedData, userId }, { new: true });

            return res.status(200).json({
                message: "Order status updated successfully",
                data: updatedStatus,
            });

        } else {
            // -------- Add flow ----------
            const existingStatus = await OrderStatus.findOne({
                organizationId,
                orderServiceId,
                status: { $regex: new RegExp("^" + cleanedData.status + "$", "i") }
            });

            if (existingStatus) {
                return res.status(400).json({ message: "This status already exists for the organization." });
            }

            cleanedData.createdDateTime = moment.tz(cleanedData.saleOrderDate, "YYYY-MM-DDTHH:mm:ss.SSS[Z]", organizationExists.timeZoneExp).toISOString();

            const newOrderStatus = new OrderStatus({
                ...cleanedData,
                organizationId,
                userId,
            });

            const savedOrderStatus = await newOrderStatus.save();

            return res.status(201).json({
                message: "Order status created successfully",
                data: savedOrderStatus,
            });
        }
    } catch (error) {
        console.error("Error in add or edit order status:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


// Get All Orders Status (Filtered by orderId if provided)
exports.getAllOrderStatus = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { orderId } = req.query;

        if (orderId && (!mongoose.Types.ObjectId.isValid(orderId) || orderId.length !== 24)) {
            return res.status(400).json({ message: `Invalid Order ID: ${orderId}` });
        }

        const { organizationExists } = await dataExist(organizationId, null);

        const filter = { organizationId };
        if (orderId) {
            filter.orderId = orderId;
        }

        const allOrderStatus = await OrderStatus.find(filter).lean();

        if (!allOrderStatus?.length) {
            return res.status(404).json({ message: "No order status found" });
        }

        const formattedObjects = multiCustomDateTime(
            allOrderStatus,
            organizationExists.dateFormatExp,
            organizationExists.timeZoneExp,
            organizationExists.dateSplit
        );

        res.status(200).json(formattedObjects);

    } catch (error) {
        console.error("Error fetching order status:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get One Order Status (Filtered by orderId if provided)
exports.getOneOrderStatus = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { statusId } = req.params;
        const { orderId } = req.query;

        // Validate statusId
        if (!mongoose.Types.ObjectId.isValid(statusId) || statusId.length !== 24) {
            return res.status(400).json({ message: `Invalid Order Status ID: ${statusId}` });
        }

        if (orderId && (!mongoose.Types.ObjectId.isValid(orderId) || orderId.length !== 24)) {
            return res.status(400).json({ message: `Invalid Order ID: ${orderId}` });
        }

        const filter = { _id: statusId, organizationId };
        if (orderId) {
            filter.orderId = orderId;
        }

        const { organizationExists } = await dataExist(organizationId, null);

        const orderStatus = await OrderStatus.findOne(filter).lean();

        if (!orderStatus) {
            return res.status(404).json({ message: "Order status not found!" });
        }

        const formattedObject = singleCustomDateTime(
            orderStatus,
            organizationExists.dateFormatExp,
            organizationExists.timeZoneExp,
            organizationExists.dateSplit
        );

        res.status(200).json(formattedObject);

    } catch (error) {
        console.error("Error fetching order status:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// // Edit Order Status
// exports.editOrderStatus = async (req, res) => {
//     console.log("Edit Order Status", req.body);
    
//     try {
//         const { organizationId, id: userId } = req.user;
//         const { statusId } = req.params;

//         // Validate statusId
//         if (!mongoose.Types.ObjectId.isValid(statusId) || statusId.length !== 24) {
//             return res.status(400).json({ message: `Invalid Order Status ID: ${statusId}` });
//         }

//         const { orderId } = cleanedData;

//         // Validate orderId
//         if (!mongoose.Types.ObjectId.isValid(orderId) || orderId.length !== 24) {
//             return res.status(400).json({ message: `Invalid Order ID: ${orderId}` });
//         }

//         // Fetch existing order status
//         const existingOrderStatus = await OrderStatus.findOne({ _id: statusId, organizationId, orderId });
//         if (!existingOrderStatus) {
//             console.log("Order status not found with ID:", statusId);
//             return res.status(404).json({ message: "Order status not found!" });
//         }

//         const cleanedData = cleanData(req.body);

//         const { organizationExists } = await dataExist(organizationId, null);
        
//         if (!validateOrganization( organizationExists, res )) return;
        
//         //Validate Inputs
//         if (!validateInputs( cleanedData, res)) return;

//         const existingStatus = await OrderStatus.findOne({
//             organizationId,
//             orderId,
//             status: { $regex: new RegExp("^" + cleanedData.status + "$", "i") },
//             _id: { $ne: statusId } // exclude the current one
//         });
          
//         if (existingStatus) {
//             return res.status(400).json({ message: "This status already exists for the organization." });
//         }          

//         cleanedData.createdDateTime = moment.tz(cleanedData.saleOrderDate, "YYYY-MM-DDTHH:mm:ss.SSS[Z]", organizationExists.timeZoneExp).toISOString();           

//         //Update Order Status
//         const mongooseDocument = OrderStatus.hydrate(existingOrderStatus);
//         Object.assign(mongooseDocument, cleanedData);
//         const savedOrderStatus = await mongooseDocument.save();
//         if (!savedOrderStatus) {
//             return res.status(500).json({ message: "Failed to update order status" });
//         }

//         console.log( "Order status updated successfully:", savedOrderStatus );

//         res.status(201).json({
//             message: "Order status updated successfully",
//             data: savedOrderStatus
//         });

//     } catch (error) {
//         console.error("Error updating order status:", error);
//         res.status(500).json({ message: "Internal server error" });
//     }
// };

// // Delete Order Status
// exports.deleteOrderStatus = async (req, res) => {
//     console.log("Delete order status request received:", req.params);

//     try {
//         const { organizationId, id: userId } = req.user;
//         const { statusId } = req.params;

//         // Validate statusId
//         if (!mongoose.Types.ObjectId.isValid(statusId) || statusId.length !== 24) {
//             return res.status(400).json({ message: `Invalid Order Status ID: ${statusId}` });
//         }

//         // Fetch existing order status
//         const existingOrderStatus = await OrderStatus.findOne({ _id: statusId, organizationId });
//         if (!existingOrderStatus) {
//             console.log("Order status not found with ID:", statusId);
//             return res.status(404).json({ message: "Order status not found!" });
//         }

//         // Delete the order status
//         const deletedOrderStatus = await existingOrderStatus.deleteOne();
//         if (!deletedOrderStatus) {
//             console.error("Failed to delete order status.");
//             return res.status(500).json({ message: "Failed to delete order status" });
//         }
    
//         res.status(200).json({ message: "Order status deleted successfully" });
//         console.log("Order status deleted successfully with ID:", statusId);

//     } catch (error) {
//         console.error("Error deleting order status:", error);
//         res.status(500).json({ message: "Internal server error" });
//     }
// };








// Validate Organization 
function validateOrganization( organizationExists, res ) {
    if (!organizationExists) {
      res.status(404).json({ message: "Organization not found" });
      return false;
    }
    return true;
  }


  //Validate inputs
function validateInputs( cleanedData, res) {
    const validationErrors = validateData( cleanedData );

    if (validationErrors.length > 0) {
      res.status(400).json({ message: validationErrors.join(", ") });
      return false;
    }
    return true;
 }

//Validate Data
function validateData( data ) {
    const errors = [];    
    //Basic Info
    validateReqFields( data, errors );
    return errors;
}

// Field validation utility
function validateField(condition, errorMsg, errors) {
    if (condition) errors.push(errorMsg);
}

//Valid Req Fields
function validateReqFields( data, errors ) {
    validateField( typeof data.orderId === 'undefined', "orderId is required!", errors  );
    validateField( typeof data.status === 'undefined', "Please enter the status!", errors  );
    validateField( typeof data.date === 'undefined', "Please select the date!", errors  );
}

