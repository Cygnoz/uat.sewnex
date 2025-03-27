const Settings = require('../database/model/settings')

exports.updatePurchaseSettings = async (req, res) => {
    try {
      const organizationId = req.user.organizationId;
      console.log("Purchase Settings:", req.body);
  
      const purchaseSettings = {
        purchaseOrderClose: req.body.purchaseOrderClose, // Purchase recorder, Bill created, Purchase & Bill recorded
        purchaseTC: req.body.purchaseTC,
        purchaseNote: req.body.purchaseNote,
      };
  
      // Find the document by organizationId
      const existingPurchaseSettings = await Settings.findOne({ organizationId });
  
      if (!existingPurchaseSettings) {
        return res.status(404).json({ message: "Purchase settings not found" });
      }
  
      // Update the document with the new Purchase Settings
      Object.assign(existingPurchaseSettings, purchaseSettings);
  
      // Save the updated document
      await existingPurchaseSettings.save();
  
      res.status(200).json("Purchase settings updated successfully");
    } catch (error) {
      console.error("Error updating purchase settings:", error);
      res.status(500).json({ message: "Internal server error.", error : error.message, stack: error.stack });
    }
  };
  
