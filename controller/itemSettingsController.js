const Organization = require("../database/model/organization");
const Settings = require("../database/model/settings");
const ItemTrack = require("../database/model/itemTrack");

const { cleanData } = require("../services/cleanData");

const moment = require("moment-timezone");



// Fetch existing data
const dataExist = async ( organizationId ) => {
  const [organizationExists, existingSettings ,itemTrack ] = await Promise.all([
    Organization.findOne({ organizationId },{ timeZoneExp: 1, dateFormatExp: 1, dateSplit: 1, organizationCountry: 1 }),
    Settings.findOne({ organizationId }),
    ItemTrack.find({ organizationId , action: "Opening Stock"},{ organizationId: 0 }) 
  ]);
  return { organizationExists, existingSettings, itemTrack };
};





exports.addItemSettings = async (req, res) => {
  console.log("Item setting:",req.body);
    try {

      const cleanedData = cleanData(req.body);      

      const organizationId = req.user.organizationId;

      const { organizationExists, existingSettings, itemTrack } = await dataExist( organizationId );   
      
      if (!organizationExists) {
        return res.status(404).json({ message: "Organization not found" });
      }

      if (!existingSettings) {
        return res.status(404).json({ message: "Settings not found" });
      }
      cleanedData.openingStockDate = moment.tz(cleanedData.openingStockDate, "YYYY-MM-DDTHH:mm:ss.SSS[Z]", organizationExists.timeZoneExp).toISOString();             
  
      
      Object.assign(existingSettings, cleanedData);
  
      await existingSettings.save();

      // Update createDate for all itemTrack entries
      if (itemTrack.length > 0) {
        await Promise.all(
          itemTrack.map(async (item) => {
            item.createdDateTime = cleanedData.openingStockDate;
            await item.save();
          })
        );
      }
  
      res.status(200).json("Item settings updated successfully");
    } catch (error) {
      console.error("Error updating item settings:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };







  // Get all items
exports.getAllItemTrack = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;


    const existingOrganization = await Organization.findOne({ organizationId });
    
    if (!existingOrganization) {
      return res.status(404).json({
        message: "No Organization Found.",
      });
    }

    const allItem = await ItemTrack.find({ organizationId },{ organizationId: 0 }); 
    if (allItem.length > 0) {
      res.status(200).json(allItem);
    } else {
      return res.status(404).json("No Items Track found.");
    }
  } catch (error) {
    console.error("Error fetching Items:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};



// item transaction 
exports.itemTransaction = async (req, res) => {
  try {
    const { id } = req.params; 
    const organizationId = req.user.organizationId;

    const itemTransactions = await ItemTrack.find({ organizationId: organizationId, itemId: id }, { organizationId: 0 }); 

    
    if (itemTransactions.length > 0) {
      res.status(200).json(itemTransactions);
    } else {
      return res.status(404).json("No transactions found for the given item");
    }
  } catch (error) {
    console.error("Error fetching item transactions:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};
