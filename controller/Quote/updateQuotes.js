
const mongoose = require('mongoose');
const SalesQuotes = require('../../database/model/salesQuotes');
const CustomerHistory = require("../../database/model/customerHistory");
const { dataExist, salesQuote, validation, calculations } = require("../Quote/salesQuotes");
const { cleanData } = require("../../services/cleanData");



// Update Sales Quote 
exports.updateSalesQuote = async (req, res) => {
    console.log("Update sales quote:", req.body);
  
    try {
      const { organizationId, id: userId, userName } = req.user;
      const { quoteId } = req.params;

      // Clean input data
      const cleanedData = cleanData(req.body);

      const { items, customerId } = cleanedData;
  
      // Fetch existing sales quote
      const existingSalesQuote = await SalesQuotes.findOne({ _id: quoteId, organizationId });
      if (!existingSalesQuote) {
        console.log("Sales quote not found with ID:", quoteId);
        return res.status(404).json({ message: "Sales quote not found" });
      }
    
      // Validate Customer
      if (!mongoose.Types.ObjectId.isValid(customerId) || customerId.length !== 24) {
        return res.status(400).json({ message: `Invalid Customer ID: ${customerId}` });
      }
  
      // Validate ItemIds
      const itemIds = items.map(item => item.itemId);
      const invalidItemIds = itemIds.filter(itemId => !mongoose.Types.ObjectId.isValid(itemId) || itemId.length !== 24);
      if (invalidItemIds.length > 0) {
        return res.status(400).json({ message: `Invalid item IDs: ${invalidItemIds.join(', ')}` });
      }
  
      // Check for duplicate itemIds
      const uniqueItemIds = new Set(itemIds);
      if (uniqueItemIds.size !== itemIds.length) {
        return res.status(400).json({ message: "Duplicate Item found in the list." });
      }
  
      // Fetch related data
      const { organizationExists, customerExist, itemTable, existingPrefix } = await dataExist.dataExist(organizationId, items, customerId);
  
     //Data Exist Validation
     if (!validation.validateOrganizationTaxCurrency( organizationExists, customerExist, existingPrefix, res )) return;
      
      // Validate Inputs
      if (!validation.validateInputs(cleanedData, customerExist, items, itemTable, organizationExists, res)) return;
  
      // Tax Type 
      calculations.taxType(cleanedData, customerExist, organizationExists);
  
      // Calculate Sales Order
      if (!calculations.calculateSalesOrder(cleanedData, res)) return;
  
      // Ensure `salesQuote` field matches the existing order
      const salesQuote = cleanedData.salesQuotes;
      if (salesQuote !== existingSalesQuote.salesQuotes) {
        console.error("Mismatched salesQuote values.");
        return res.status(400).json({
            message: `The provided salesQuote does not match the existing record. Expected: ${existingSalesQuote.salesQuotes}`
        });
    }

      // Update Sales Quote Fields (Ensure system-managed fields are untouched)
      existingSalesQuote.set({
        ...cleanedData,
        lastModifiedDate: new Date(),
      });
  
      // Save Updated Sales Quote
      const savedSalesQuote = await existingSalesQuote.save();
      if (!savedSalesQuote) {
          console.error("Failed to save updated sales quote.");
          return res.status(500).json({ message: "Failed to update sales quote" });
      }

      // Add entry to Customer History
      const customerHistoryEntry = new CustomerHistory({
        organizationId,
        operationId: savedSalesQuote._id,
        customerId,
        title: "Quote Updated",
        description: `Quote ${savedSalesQuote.salesQuotes} updated by ${userName}`,
        userId: userId,
        userName: userName,
      });
  
      await customerHistoryEntry.save();
  
      res.status(200).json({ message: "Sale quote updated successfully", savedSalesQuote });
      console.log("Sale quote updated successfully:", savedSalesQuote);
  
    } catch (error) {
      console.error("Error updating sale quote:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };







// Delete Sales Quote
exports.deleteSalesQuote = async (req, res) => {
  console.log("Delete sales quote request received:", req.params);

  try {
      const { organizationId, id: userId, userName } = req.user;
      const { quoteId } = req.params;

      // Validate quoteId
      if (!mongoose.Types.ObjectId.isValid(quoteId) || quoteId.length !== 24) {
          return res.status(400).json({ message: `Invalid Sales Quote ID: ${quoteId}` });
      }

      // Fetch existing sales quote
      const existingSalesQuote = await SalesQuotes.findOne({ _id: quoteId, organizationId });
      if (!existingSalesQuote) {
          console.log("Sales quote not found with ID:", quoteId);
          return res.status(404).json({ message: "Sales quote not found" });
      }

      // Add entry to Customer History
      const customerHistoryEntry = new CustomerHistory({
        organizationId,
        operationId: existingSalesQuote._id,
        customerId: existingSalesQuote.customerId,
        title: "Quote Deleted",
        description: `Quote ${existingSalesQuote.salesQuotes} deleted by ${userName}`,
        userId: userId,
        userName: userName,
      });

      // Delete the sales quote
      const deletedSalesQuote = await existingSalesQuote.deleteOne();
      if (!deletedSalesQuote) {
          console.error("Failed to delete sales quote.");
          return res.status(500).json({ message: "Failed to delete sales quote" });
      }

      await customerHistoryEntry.save();

      res.status(200).json({ message: "Sales quote deleted successfully" });
      console.log("Sales quote deleted successfully with ID:", quoteId);

  } catch (error) {
      console.error("Error deleting sales quote:", error);
      res.status(500).json({ message: "Internal server error" });
  }
};
