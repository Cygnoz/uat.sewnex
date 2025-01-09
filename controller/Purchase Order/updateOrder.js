
const mongoose = require('mongoose');
const PurchaseOrder = require('../../database/model/purchaseOrder');
const { dataExist, purchaseOrder, validation, calculations } = require("../Purchase Order/purchaseOrderController");
const { cleanData } = require("../../services/cleanData");



// Update Purchase Order 
exports.updatePurchaseOrder = async (req, res) => {
    console.log("Update purchase order:", req.body);
    // console.log("purchaseOrder exports", purchaseOrder);
  
    try {
      const organizationId = req.user.organizationId;
      const { orderId } = req.params;
      const cleanedData = cleanData(req.body);
  
      // Fetch existing purchase order
      const existingPurchaseOrder = await PurchaseOrder.findOne({ _id: orderId, organizationId });
      if (!existingPurchaseOrder) {
        console.log("Purchase order not found with ID:", orderId);
        return res.status(404).json({ message: "Purchase order not found" });
      }
  
      const { items, supplierId } = cleanedData;
  
      // Validate Supplier
      if (!mongoose.Types.ObjectId.isValid(supplierId) || supplierId.length !== 24) {
        return res.status(400).json({ message: `Invalid Supplier ID: ${supplierId}` });
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
      const { organizationExists, supplierExist, itemTable, taxExists, settings, existingPrefix } = await dataExist.dataExist(organizationId, supplierId, items);
  
      // Data Exist Validation
      if (!validation.validateOrganizationSupplierPrefix(organizationExists, supplierExist, existingPrefix, res)) return;
  
      // Validate Inputs
      if (!validation.validateInputs(cleanedData, supplierExist, items, itemTable, organizationExists, res)) return;
  
      // Tax Type 
      calculations.taxtype(cleanedData, supplierExist);
  
      // Calculate Purchase Order
      if (!calculations.calculatePurchaseOrder(cleanedData, res)) return;
  
      // Preserve Purchase Order ID and Prefix
      cleanedData._id = existingPurchaseOrder._id;
      cleanedData.purchaseOrder = existingPurchaseOrder.purchaseOrder;
  
      // Update purchase order fields
      Object.assign(existingPurchaseOrder, cleanedData);
      existingPurchaseOrder.lastModifiedDate = purchaseOrder.generateOpeningDate(organizationExists);
  
      const updatedPurchaseOrder = await existingPurchaseOrder.save();
  
      if (!updatedPurchaseOrder) {
        console.error("Purchase order could not be saved.");
        return res.status(500).json({ message: "Failed to update purchase order" });
      }
  
      res.status(200).json({ message: "Purchase order updated successfully", updatedPurchaseOrder });
      console.log("Purchase order updated successfully:", updatedPurchaseOrder);
  
    } catch (error) {
      console.error("Error updating purchase order:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };