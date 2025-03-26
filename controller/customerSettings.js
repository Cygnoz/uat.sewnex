const Organization = require("../database/model/organization");
const Settings = require('../database/model/settings');

const dataExist = async (organizationId) => {
  const [organizationExists, settings] = await Promise.all([
    Organization.findOne({ organizationId }),
    Settings.findOne({ organizationId })  // Updated to use findOne for Settings
  ]);
  return { organizationExists, settings };
};

exports.updateCustomerSettings = async (req, res) => {
  try {

    const { organizationId } = req.user;
    console.log("Customer Settings:", req.body);
   
    // Clean the incoming data to remove empty/null values
    const cleanedData = cleanCustomerData(req.body);

    // Check if organization and settings exist
    const { organizationExists, settings } = await dataExist(organizationId);

    if (!organizationExists) {
      return res.status(404).json({ message: "Organization not found" });
    }

    if (!settings) {
      return res.status(404).json({ message: "Settings not found for the given organization" });
    }
    // Merge cleanedData into the existing settings object
    Object.assign(settings, cleanedData);

    // Save the updated settings document
    await settings.save();

    res.status(200).json("Customer settings updated successfully");
  } catch (error) {
    console.error("Error updating Customer settings:", error);
    res.status(500).json({ message: "Internal server error.",error:error.message, stack:error.stack });
  }
};

// Helper function to clean the data
function cleanCustomerData(data) {
  const cleanData = (value) => (value === null || value === undefined || value === "" || value === 0 ? undefined : value);
  return Object.keys(data).reduce((acc, key) => {
    acc[key] = cleanData(data[key]);
    return acc;
  }, {});
}



