const Organization = require("../../database/model/organization");

const OrderStatus = require("../model/orderStatus");
const SewnexSetting = require("../model/sxSetting");
const sxOrderService = require("../model/sxOrderService");

const { cleanData } = require("../../services/cleanData");
const { singleCustomDateTime, multiCustomDateTime } = require("../../services/timeConverter");

const mongoose = require('mongoose');
const moment = require("moment-timezone");


// Fetch existing data
const dataExist = async ( organizationId, statusId) => {
    const [organizationExists, orderStatus, sewnexSetting ] = await Promise.all([
      Organization.findOne({ organizationId },{ timeZoneExp: 1, dateFormatExp: 1, dateSplit: 1, organizationCountry: 1 }).lean(),
      OrderStatus.findOne({ organizationId, _id: statusId }).lean(),
      SewnexSetting.findOne({ organizationId }).lean(),
    ]);
    return { organizationExists, orderStatus, sewnexSetting };
};



// Add Order Status
// exports.addOrderStatus = async (req, res) => {
//     console.log("Add or Edit Order Status", req.body);

//     try {
//         const { organizationId, id: userId } = req.user;
//         const cleanedData = cleanData(req.body);
//         const { orderServiceId, orderStatus, remarks } = cleanedData;

//         // Check organization
//         const { organizationExists, sewnexSetting } = await dataExist(organizationId, null);

//         if (!validateOrganizationSetting(organizationExists, sewnexSetting, res)) return;

//         // Validate inputs
//         if (!validateInputs(cleanedData, orderStatus, sewnexSetting, res)) return;

//         // Check if order status entry exists
//         const existingOrderStatus = await OrderStatus.findOne({
//             organizationId,
//             orderServiceId
//         });

//         if (!existingOrderStatus) {
//             return res.status(404).json({ message: "Order status entry not found for this service." });
//         }

//         const statuses = Array.isArray(orderStatus) ? orderStatus : [orderStatus];
//         let addedStatuses = [];

//         statuses.forEach(statusEntry => {
//             const alreadyExists = existingOrderStatus.orderStatus.some(existing =>
//                 existing.status === statusEntry.status
//             );

//             if (!alreadyExists) {
//                 existingOrderStatus.orderStatus.push({
//                     status: statusEntry.status,
//                     date: statusEntry.date
//                 });
//                 addedStatuses.push(statusEntry.status);
//             } else {
//                 console.log(`Status "${statusEntry.status}" already exists, skipping.`);
//             }
//         });

//         if (addedStatuses.length === 0) {
//             return res.status(200).json({ message: "No new statuses added; all were duplicates." });
//         }

//         // Update remarks
//         existingOrderStatus.remarks = remarks;

//         // Save
//         await existingOrderStatus.save();

//         // Get the latest status (last in the array)
//         const latestStatus = existingOrderStatus.orderStatus[existingOrderStatus.orderStatus.length - 1]?.status;

//         // Update status in SewnexOrderService
//         if (latestStatus) {
//             await sxOrderService.findOneAndUpdate(
//                 { organizationId, _id: orderServiceId },
//                 { status: latestStatus },
//                 { new: true }
//             );
//         }

//         res.status(200).json({
//             message: `Order status updated successfully. Added statuses: ${addedStatuses.join(", ")}`,
//             data: existingOrderStatus
//         });

//     } catch (error) {
//         console.error("Error in addOrderStatus:", error);
//         res.status(500).json({ message: "Internal server error" });
//     }
// };
exports.addOrderStatus = async (req, res) => {
    console.log("Add or Edit Order Status", req.body);

    try {
        const { organizationId, id: userId } = req.user;
        const cleanedData = cleanData(req.body);
        const { orderServiceId, orderStatus, remarks } = cleanedData;

        // Check organization
        const { organizationExists, sewnexSetting } = await dataExist(organizationId, null);

        if (!validateOrganizationSetting(organizationExists, sewnexSetting, res)) return;

        if (!validateInputs(cleanedData, orderStatus, sewnexSetting, res)) return;

        // Check if order status entry exists
        const existingOrderStatus = await OrderStatus.findOne({
            organizationId,
            orderServiceId
        });

        if (!existingOrderStatus) {
            return res.status(404).json({ message: "Order status entry not found for this service." });
        }

        const statuses = Array.isArray(orderStatus) ? orderStatus : [orderStatus];
        let addedOrUpdatedStatuses = [];

        statuses.forEach(statusEntry => {
            const existingStatus = existingOrderStatus.orderStatus.find(existing =>
                existing.status === statusEntry.status
            );

            if (existingStatus) {
                // Update date and remarks if status exists
                existingStatus.date = statusEntry.date;
                addedOrUpdatedStatuses.push(`${statusEntry.status} (updated)`);
            } else {
                // Push new status
                existingOrderStatus.orderStatus.push({
                    status: statusEntry.status,
                    date: statusEntry.date
                });
                addedOrUpdatedStatuses.push(`${statusEntry.status} (added)`);
            }
        });

        // Update remarks at the root level
        existingOrderStatus.remarks = remarks;

        // Save
        await existingOrderStatus.save();

        // Update sewnexOrderService with the latest status
        const latestStatus = existingOrderStatus.orderStatus[existingOrderStatus.orderStatus.length - 1]?.status;

        if (latestStatus) {
            await sxOrderService.findOneAndUpdate(
                { organizationId, _id: orderServiceId },
                { status: latestStatus },
                { new: true }
            );
        }

        res.status(200).json({
            message: `Order status successfully updated. Changed statuses: ${addedOrUpdatedStatuses.join(", ")}`,
            data: existingOrderStatus
        });

    } catch (error) {
        console.error("Error in addOrderStatus:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


// Get One Order Status (Filtered by orderId if provided)
exports.getOneOrderStatus = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { orderServiceId, statusId } = req.params;

        // Validate statusId
        if (!mongoose.Types.ObjectId.isValid(statusId) || statusId.length !== 24) {
            return res.status(400).json({ message: `Invalid Order Status ID: ${statusId}` });
        }

        // Validate orderServiceId
        if (orderServiceId && (!mongoose.Types.ObjectId.isValid(orderServiceId) || orderServiceId.length !== 24)) {
            return res.status(400).json({ message: `Invalid Order Service ID: ${orderServiceId}` });
        }

        const { organizationExists, orderStatus } = await dataExist(organizationId, statusId);

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










// Validate Organization 
function validateOrganizationSetting( organizationExists, SewnexSetting, res ) {
    if (!organizationExists) {
      res.status(404).json({ message: "Organization not found" });
      return false;
    }
    // if (!SewnexSetting) {
    //     res.status(404).json({ message: "SewnexSetting not found" });
    //     return false;
    // }
    return true;
  }


  //Validate inputs
function validateInputs( cleanedData, orderStatus, SewnexSetting, res) {
    const validationErrors = validateData( cleanedData, orderStatus, SewnexSetting );

    if (validationErrors.length > 0) {
      res.status(400).json({ message: validationErrors.join(", ") });
      return false;
    }
    return true;
 }

//Validate Data
function validateData( data, orderStatus, settings ) {
    const errors = [];    
    //Basic Info
    validateReqFields( data, orderStatus, settings, errors );
    return errors;
}

// Field validation utility
function validateField(condition, errorMsg, errors) {
    if (condition) errors.push(errorMsg);
}

//Valid Req Fields
function validateReqFields( data, orderStatus, settings, errors ) {
    validateField( typeof data.orderServiceId === 'undefined', "orderServiceId is required!", errors  );

    if (!orderStatus || !Array.isArray(orderStatus) || orderStatus.length === 0) {
        errors.push("orderStatus array is required.");
        return;
    }

    // const validStatuses = settings.orderStatus.map(s => s.orderStatusName);

    orderStatus.forEach((OS) => {
        validateField( typeof OS.status === 'undefined', "Please select the status!", errors  );
        validateField( typeof OS.date === 'undefined', "Please select the date!", errors  );
        // validateField( !validStatuses.includes(OS.status), `Invalid status: ${OS.status}`, errors );
    });
}



