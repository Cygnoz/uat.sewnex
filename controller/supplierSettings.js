const Organization = require("../database/model/organization");
const Settings = require('../database/model/settings');

const dataExist = async (organizationId) => {
  const [organizationExists, settings] = await Promise.all([
    Organization.findOne({ organizationId }),
    Settings.findOne({ organizationId })
  ]);
  return { organizationExists, settings };
};

const cleanData = (data) => {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      value === null || value === undefined || value === "" || value === 0 ? undefined : value
    ])
  );
};

exports.updateSupplierCustomerSettings = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const cleanedData = cleanData(req.body);
    
    const { organizationExists, settings } = await dataExist(organizationId);

    if (!organizationExists || !settings) {
      const missingResource = !organizationExists ? "Organization" : "Settings";
      return res.status(404).json({ message: `${missingResource} not found for the given organization` });
    }

    Object.assign(settings, cleanedData);
    await settings.save();

    res.status(200).json({ message: "Settings updated successfully" });
  } catch (error) {
    console.error("Error updating supplier settings:", error);
    res.status(500).json({ message: "Internal server error.", error : error.message, stack: error.stack });
  }
};

