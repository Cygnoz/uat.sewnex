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




// Setup or update sewnex order setting
exports.addSewnexOrderSetting = async (req, res) => {
    console.log("Order Settings Request Body:", req.body);

    try {
        const { organizationId, id: userId } = req.user;
        
        const cleanedData = cleanData(req.body);

        // Check organization
        const { organizationExists, existingOrderSetting } = await dataExist(organizationId);

        if (!organizationExists) {
            return res.status(404).json({ message: "Organization not found!" });
        }

        let savedOrderSetting;

        if (existingOrderSetting) {
            // Update existing settings
            savedOrderSetting = await SewnexSetting.findOneAndUpdate(
                { organizationId },
                { ...cleanedData },
                { new: true }
            );
            console.log("Order settings updated:", savedOrderSetting);
        } else {
            // Create new settings
            const newOrderSetting = new SewnexSetting({
                ...cleanedData,
                organizationId,
                userId,
            });
            savedOrderSetting = await newOrderSetting.save();
            console.log("Order settings created:", savedOrderSetting);
        }

        res.status(200).json({
            message: existingOrderSetting ? "Order settings updated successfully" : "Order settings created successfully",
            data: savedOrderSetting
        });

    } catch (error) {
        console.error("Error setting up order settings:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};





// Get sewnex order setting
exports.getSewnexOrderSetting = async (req, res) => {
    try {
        const { organizationId } = req.user;

        // Fetch organization and sewnex settings
        const { organizationExists, existingOrderSetting } = await dataExist(organizationId);

        if (!existingOrderSetting?.length) {
            return res.status(404).json({ message: "No sewnex order setting found!" });
        }

        const formattedObjects = singleCustomDateTime(existingOrderSetting, organizationExists.dateFormatExp, organizationExists.timeZoneExp, organizationExists.dateSplit );       

        res.status(200).json(formattedObjects);

    } catch (error) {
        console.error("Error fetching sewnex settings:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};








  