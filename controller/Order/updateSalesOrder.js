
const mongoose = require('mongoose');
const SalesOrder = require('../../database/model/salesOrder');
const CustomerHistory = require("../../database/model/customerHistory");
const { dataExist, salesOrder, validation, calculation } = require("../Order/salesOrder");
const { cleanData } = require("../../services/cleanData");



// Update Sales Order 
exports.updateSalesOrder = async (req, res) => {
    console.log("Update sales order:", req.body);
  
    try {
      const { organizationId, id: userId, userName } = req.user;
      const { orderId } = req.params;

      // Clean input data
      const cleanedData = cleanData(req.body);

      const { items, customerId, customerName } = cleanedData;
  
      // Fetch existing sales order
      const existingSalesOrder = await SalesOrder.findOne({ _id: orderId, organizationId });
      if (!existingSalesOrder) {
        console.log("Sales order not found with ID:", orderId);
        return res.status(404).json({ message: "Sales order not found" });
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
      const { organizationExists, customerExist, settings, existingPrefix } = await dataExist.dataExist(organizationId, customerId, customerName);

      const { itemTable } = await dataExist.newDataExists( organizationId, items );
  
     //Data Exist Validation
     if (!validation.validateOrganizationTaxCurrency( organizationExists, customerExist, existingPrefix, res )) return;
      
      // Validate Inputs
      if (!validation.validateInputs(cleanedData, settings, customerExist, items, itemTable, organizationExists, res)) return;
  
      // Tax Type 
      calculation.taxType(cleanedData, customerExist, organizationExists);
  
      // Calculate Sales Order
      if (!calculation.calculateSalesOrder(cleanedData, res)) return;
  
      // Ensure `salesOrder` field matches the existing order
      const salesOrder = cleanedData.salesOrder;
      if (salesOrder !== existingSalesOrder.salesOrder) {
        console.error("Mismatched salesOrder values.");
        return res.status(400).json({
            message: `The provided salesOrder does not match the existing record. Expected: ${existingSalesOrder.salesOrder}`
        });
    }

      // Update Sales Order Fields (Ensure system-managed fields are untouched)
      existingSalesOrder.set({
        ...cleanedData,
        lastModifiedDate: new Date(),
      });
  
      // Save Updated Sales Order
      const savedSalesOrder = await existingSalesOrder.save();
      if (!savedSalesOrder) {
          console.error("Failed to save updated sales order.");
          return res.status(500).json({ message: "Failed to update sales order" });
      }

      // Add entry to Customer History
      const customerHistoryEntry = new CustomerHistory({
        organizationId,
        operationId: savedSalesOrder._id,
        customerId,
        title: "Sales Order Updated",
        description: `Sales order ${savedSalesOrder.salesOrder} updated by ${userName}`,
        userId: userId,
        userName: userName,
      });
  
      await customerHistoryEntry.save();
  
      res.status(200).json({ message: "Sale order updated successfully", savedSalesOrder });
      console.log("Sale order updated successfully:", savedSalesOrder);
  
    } catch (error) {
      console.error("Error updating sale order:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };









// Delete Sales order
exports.deleteSalesOrder = async (req, res) => {
  console.log("Delete sales order request received:", req.params);

  try {
      const { organizationId, id: userId, userName } = req.user;
      const { orderId } = req.params;

      // Validate orderId
      if (!mongoose.Types.ObjectId.isValid(orderId) || orderId.length !== 24) {
          return res.status(400).json({ message: `Invalid Sales Order ID: ${orderId}` });
      }

      // Fetch existing sales order
      const existingSalesOrder = await SalesOrder.findOne({ _id: orderId, organizationId });
      if (!existingSalesOrder) {
          console.log("Sales order not found with ID:", orderId);
          return res.status(404).json({ message: "Sales order not found" });
      }

      // Add entry to Customer History
      const customerHistoryEntry = new CustomerHistory({
        organizationId,
        operationId: existingSalesOrder._id,
        customerId: existingSalesOrder.customerId,
        title: "Sales Order Deleted",
        description: `Sales order ${existingSalesOrder.salesOrder} deleted by ${userName}`,
        userId: userId,
        userName: userName,
      });

      // Delete the sales order
      const deletedSalesOrder = await existingSalesOrder.deleteOne();
      if (!deletedSalesOrder) {
          console.error("Failed to delete sales order.");
          return res.status(500).json({ message: "Failed to delete sales order" });
      }
  
      await customerHistoryEntry.save();

      res.status(200).json({ message: "Sales order deleted successfully" });
      console.log("Sales order deleted successfully with ID:", orderId);

  } catch (error) {
      console.error("Error deleting sales order:", error);
      res.status(500).json({ message: "Internal server error" });
  }
};