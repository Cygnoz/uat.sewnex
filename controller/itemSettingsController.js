const Organization = require("../database/model/organization");
const Settings = require("../database/model/settings");
const ItemTrack = require("../database/model/itemTrack");



exports.addItemSettings = async (req, res) => {
    try {
      const organizationId = req.user.organizationId;
      console.log("Item setting:",req.body);
  
      const itemSettings = {
        itemDecimal: req.body.itemDecimal,
        itemDimensions: req.body.itemDimensions,
        itemWeights: req.body.itemWeights,
        barcodeScan: req.body.barcodeScan,
        itemDuplicateName: req.body.itemDuplicateName,
        hsnSac: req.body.hsnSac,
        hsnDigits: req.body.hsnDigits,
        priceList: req.body.priceList,
        priceListAtLineLevel: req.body.priceListAtLineLevel,
        compositeItem: req.body.compositeItem,
        stockBelowZero: req.body.stockBelowZero,
        outOfStockBelowZero: req.body.outOfStockBelowZero,
        notifyReorderPoint: req.body.notifyReorderPoint,
        trackCostOnItems: req.body.trackCostOnItems,
      };
  
      // Find the document by organizationId
      const existingSettings = await Settings.findOne({ organizationId });
  
      if (!existingSettings) {
        return res.status(404).json({ message: "Settings not found" });
      }
  
      // Update the document with the new item settings
      Object.assign(existingSettings, itemSettings);
  
      // Save the updated document
      await existingSettings.save();
  
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


    // Check if an Organization already exists
    const existingOrganization = await Organization.findOne({ organizationId });
    
    if (!existingOrganization) {
      return res.status(404).json({
        message: "No Organization Found.",
      });
    }

    const allItem = await ItemTrack.find({ organizationId });
    if (allItem.length > 0) {
      const AllItem = allItem.map((history) => {
        const { organizationId, ...rest } = history.toObject(); // Convert to plain object and omit organizationId
        return rest;
      });
      res.status(200).json(AllItem);
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
    // const { organizationId } = req.body; 
    const organizationId = req.user.organizationId;

    // Find documents matching organizationId and itemId, sorted by creation date (oldest to newest)
    const itemTransactions = await ItemTrack.find({
      organizationId: organizationId,
      itemId: id
    }); // 1 for ascending order (oldest to newest)

    // const itemTransactions = await ItemTrack.find({
    //   organizationId: organizationId,
    //   itemId: id
    // }).sort({ createdAt: 1 }); // 1 for ascending order (oldest to newest)

    
    if (itemTransactions.length > 0) {
      const ItemTransactions = itemTransactions.map((history) => {
        const { organizationId, ...rest } = history.toObject(); // Convert to plain object and omit organizationId
        return rest;
      });
      res.status(200).json(ItemTransactions);
    } else {
      return res.status(404).json("No transactions found for the given item");
    }
  } catch (error) {
    console.error("Error fetching item transactions:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};
