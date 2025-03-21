const Organization = require("../../database/model/organization");

const SewnexSetting = require("../model/sxSetting");

const { cleanData } = require("../../services/cleanData");
const { singleCustomDateTime, multiCustomDateTime } = require("../../services/timeConverter");

const mongoose = require('mongoose');
const moment = require("moment-timezone");



// Fetch existing data
const dataExist = async ( organizationId ) => {
    const [organizationExists, existingOrderSetting ] = await Promise.all([
      Organization.findOne({ organizationId },{ timeZoneExp: 1, dateFormatExp: 1, dateSplit: 1, organizationCountry: 1 }).lean(),
      SewnexSetting.findOne({ organizationId }).lean(),
    ]);
    return { organizationExists, existingOrderSetting };
};




// Update sewnex order setting
exports.updateOrderSetting = async (req, res) => {
    console.log("Setup Order Settings Request Body:", req.body);

    try {
        const { organizationId, id: userId } = req.user;
        const cleanedData = cleanData(req.body);

        // Check organization and existing settings
        const { organizationExists } = await dataExist(organizationId);

        // Validate existing data
        if (!validateOrganization( organizationExists, res )) return;

        // Update existing settings
        const savedOrderSetting = await SewnexSetting.findOneAndUpdate(
            { organizationId },
            { ...cleanedData },
            { new: true }
        );

        console.log("Order settings updated:", savedOrderSetting);

        res.status(200).json({
            message: "Order settings updated successfully",
            data: savedOrderSetting
        });

        // let savedOrderSetting;

        // if (existingOrderSetting) {
        //     // Update existing settings
        //     savedOrderSetting = await SewnexSetting.findOneAndUpdate(
        //         { organizationId },
        //         { ...cleanedData },
        //         { new: true }
        //     );
        //     console.log("Order settings updated:", savedOrderSetting);
        // } else {
        //     // Create new settings
        //     const newOrderSetting = new SewnexSetting({
        //         ...cleanedData,
        //         organizationId,
        //         userId,
        //     });
        //     savedOrderSetting = await newOrderSetting.save();
        //     console.log("Order settings created:", savedOrderSetting);
        // }

        // res.status(200).json({
        //     message: existingOrderSetting ? "Order settings updated successfully" : "Order settings created successfully",
        //     data: savedOrderSetting
        // });

    } catch (error) {
        console.error("Error updating order settings:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


// Update sewnex staff setting
exports.updateStaffSetting = async (req, res) => {
    console.log("Setup Staff Settings Request Body:", req.body);

    try {
        const { organizationId, id: userId } = req.user;
        const cleanedData = cleanData(req.body);

        // Check organization and existing settings
        const { organizationExists } = await dataExist(organizationId);

        // Validate existing data
        if (!validateOrganization( organizationExists, res )) return;

        // Update existing settings
        const savedStaffSetting = await SewnexSetting.findOneAndUpdate(
            { organizationId },
            { ...cleanedData },
            { new: true }
        );

        console.log("Staff settings updated:", savedStaffSetting);

        res.status(200).json({
            message: "Staff settings updated successfully",
            data: savedStaffSetting
        });

    } catch (error) {
        console.error("Error updating staff settings:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


// Setup order status setting
exports.updateOrderStatusSetting = async (req, res) => {
    console.log("Setup Order Status Settings Request Body:", req.body);

    try {
        const { organizationId } = req.user;
        const cleanedData = cleanData(req.body);
        let { orderStatus } = cleanedData;

        if (!orderStatus || !Array.isArray(orderStatus)) {
            return res.status(400).json({ message: "orderStatus must be an array" });
        }

        // Check organization and existing settings
        const { organizationExists } = await dataExist(organizationId);

        if (!validateOrganization(organizationExists, res)) return;

        const mandatoryStatuses = ["Order Placed", "Manufacturing", "Delivery"];

        // Check if "Order Placed" is first and present
        if (orderStatus[0].orderStatusName.toLowerCase() !== "order placed") {
            return res.status(400).json({ message: `"Order Placed" must always be the first status and cannot move.` });
        }

        // Check for missing mandatory statuses
        const missingMandatoryStatuses = mandatoryStatuses.filter(
            statusName =>
                !orderStatus.find(
                    s => s.orderStatusName.toLowerCase() === statusName.toLowerCase()
                )
        );

        if (missingMandatoryStatuses.length > 0) {
            return res.status(400).json({
                message: `Missing mandatory order status values: ${missingMandatoryStatuses.join(", ")}`
            });
        }

        // Remove duplicates if accidentally added multiple times
        orderStatus = orderStatus.filter(
            (status, index, self) =>
                index === self.findIndex(s => s.orderStatusName.toLowerCase() === status.orderStatusName.toLowerCase())
        );

        // Update settings
        const updatedSettings = await SewnexSetting.findOneAndUpdate(
            { organizationId },
            { orderStatus },
            { new: true }
        );

        console.log("Order status array updated with protection:", updatedSettings);

        res.status(200).json({
            message: "Order status updated successfully.",
            data: updatedSettings
        });

    } catch (error) {
        console.error("Error updating order status settings:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


// Setup manufacturing status setting
exports.updateManufacturingStatusSetting = async (req, res) => {
    console.log("Setup Order Status Settings Request Body:", req.body);

    try {
        const { organizationId } = req.user;
        const cleanedData = cleanData(req.body);
        let { manufacturingStatus } = cleanedData;

        if (!manufacturingStatus || !Array.isArray(manufacturingStatus)) {
            return res.status(400).json({ message: "manufacturingStatus must be an array" });
        }

        // Check organization
        const { organizationExists } = await dataExist(organizationId);

        if (!validateOrganization(organizationExists, res)) return;

        const mandatoryStatuses = ["Cutting", "Stitching", "Embroidery", "Dying"];

        // Check for missing mandatory statuses
        const missingMandatoryStatuses = mandatoryStatuses.filter(
            statusName =>
                !manufacturingStatus.find(
                    s => s.manufacturingStatusName.toLowerCase() === statusName.toLowerCase()
                )
        );

        if (missingMandatoryStatuses.length > 0) {
            return res.status(400).json({
                message: `Missing mandatory order status values: ${missingMandatoryStatuses.join(", ")}`
            });
        }

        // Remove duplicates if accidentally added multiple times
        manufacturingStatus = manufacturingStatus.filter(
            (status, index, self) =>
                index === self.findIndex(s => s.manufacturingStatusName.toLowerCase() === status.manufacturingStatusName.toLowerCase())
        );

        // Update settings
        const updatedSettings = await SewnexSetting.findOneAndUpdate(
            { organizationId },
            { manufacturingStatus },
            { new: true }
        );

        console.log("Manufacturing status array updated with protection:", updatedSettings);

        res.status(200).json({
            message: "Manufacturing status updated successfully.",
            data: updatedSettings
        });

    } catch (error) {
        console.error("Error updating manufacturing status settings:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


// Get sewnex order setting
exports.getOrderSetting = async (req, res) => {
    try {
        const { organizationId } = req.user;

        // Fetch organization and sewnex settings
        const { organizationExists, existingOrderSetting } = await dataExist(organizationId);

        if (!existingOrderSetting) {
            return res.status(404).json({ message: "No order settings found!" });
        }

        // Validate existing data
        if (!validateOrganization( organizationExists, res )) return;

        const formattedObjects = singleCustomDateTime(existingOrderSetting, organizationExists.dateFormatExp, organizationExists.timeZoneExp, organizationExists.dateSplit );       

        res.status(200).json(formattedObjects);

    } catch (error) {
        console.error("Error fetching sewnex settings:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};




// Validate Organization
function validateOrganization( organizationExists, res ) {
    if (!organizationExists) {
      res.status(404).json({ message: "Organization not found" });
      return false;
    }
    return true;
}













