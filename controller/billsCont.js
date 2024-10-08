const PurchaseBill = require('../database/model/bills');
const PurchaseOrder = require('../database/model/purchaseOrder');
const Organization = require('../database/model/organization');
const Supplier = require('../database/model/supplier');
const Item = require('../database/model/item');
const Settings = require("../database/model/settings"); // Added settings model
const ItemTrack = require("../database/model/itemTrack");

// Fetch existing data including settings
const dataExistForBill = async (organizationId, supplierId, itemTable, orderNumber) => {
  const [organizationExists, supplierExists, purchaseOrderExists, items, settings] = await Promise.all([
    Organization.findOne({ organizationId }),
    Supplier.findOne({ _id: supplierId }),
    PurchaseOrder.findOne({ orderNumber, organizationId }),  // Check if purchase order exists
    Promise.all(itemTable.map(item => Item.findOne({ _id: item.itemId }))),
    Settings.findOne({ organizationId })  // Fetch settings for the organization
  ]);
  return { organizationExists, supplierExists, purchaseOrderExists, items, settings };
};

// Add a new bill
exports.addBill = async (req, res) => {
  console.log("Add purchase bill:", req.body);

  const { organizationId, supplierId, itemTable, billDate, orderNumber, ...otherDetails } = req.body;

  try {
    // Clean Data
    const cleanedData = cleanBillData(req.body);

    // Fetch existing data including settings
    const { organizationExists, supplierExists, purchaseOrderExists, items, settings } = await dataExistForBill(organizationId, supplierId, itemTable, orderNumber);

    // Validate Inputs
    if (!validateBillInputs(organizationExists, supplierExists, purchaseOrderExists, items, settings, res)) return;

    // Check for existing bill
    if (await checkExistingBill(cleanedData.billNumber, organizationId, res)) return;

    // Create new bill
    const savedBill = await createNewBill(cleanedData, organizationId);

      // Track the items from the bill
      await trackItemsFromBill(organizationId, itemTable, billDate , savedBill);

    // Send success response
    res.status(201).json({ message: "Bill added successfully.", bill: savedBill });
  } catch (error) {
    console.error("Error adding bill:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Add purchased items from the bill to item tracking
const trackItemsFromBill = async (organizationId, itemTable, billDate , savedBill) => {
  for (const billItem of itemTable) {
    const { itemId, itemName, itemQuantity } = billItem;

    // Find the item to update its stock (credit the quantity from the bill)
    const savedItem = await Item.findOne({ _id: itemId, organizationId });

    if (savedItem) {
      // Update the current stock based on the quantity from the bill
      const newStock = (savedItem.currentStock || 0) + Number(itemQuantity);

      // Assuming you need to log or use itemName somewhere:
      console.log(`Processing item: ${itemName}`); // Add usage here

      // Create a new tracking entry for the item in the bill
      const trackEntry = new ItemTrack({
        organizationId,
        operationId:savedBill._id, // Reference to the item
        action: "Purchase", // Action representing the bill
        date: billDate,
        itemId: savedItem._id,
        itemName: savedItem.itemName,
        creditQuantity: Number(itemQuantity), // Credit the quantity from the bill
        currentStock: newStock, // Updated stock after bill
        remark: `Bill of ${itemQuantity} units`,
      });

      // Save the tracking entry
      await trackEntry.save();

      // Update the item's stock in the `Item` collection
      savedItem.currentStock = newStock;
      await savedItem.save();

      console.log("Item Track Added for Bill:", trackEntry);
    } else {
      console.log(`Item with ID ${itemId} not found.`);
    }
  }
};

// Clean data for bill
function cleanBillData(data) {
  const cleanData = (value) => (value === null, value === undefined, value === "" || value === 0 ? undefined : value);
  return Object.keys(data).reduce((acc, key) => {
    acc[key] = cleanData(data[key]);
    return acc;
  }, {});
}

// Validate inputs for bill, including settings validation
function validateBillInputs(organizationExists, supplierExists, purchaseOrderExists, items, settings, res) {
  if (!organizationExists) {
    res.status(404).json({ message: "Organization not found" });
    return false;
  }
  if (!supplierExists) {
    res.status(404).json({ message: "Supplier not found" });
    return false;
  }
  // if (!purchaseOrderExists) {
  //   res.status(404).json({ message: "Purchase order not found" });
  //   return false;
  // }
  if (items.some(item => !item)) {
    res.status(404).json({ message: "Items not found" });
    return false;
  }
  if (!settings) {
    res.status(404).json({ message: "Settings not found for this organization." });
    return false;
  }
  // You can add further validation logic using `settings` here, for example:
  // if (!settings.allowBillCreation) {
  //   res.status(403).json({ message: "Bill creation is disabled in settings." });
  //   return false;
  // }

  return true;
}

// Check for existing bill
async function checkExistingBill(billNumber, organizationId, res) {
  const existingBill = await PurchaseBill.findOne({ billNumber, organizationId });
  if (existingBill) {
    res.status(409).json({ message: "Bill already exists." });
    return true;
  }
  return false;
}

// Create new bill
async function createNewBill(data, organizationId) {
  const newBill = new PurchaseBill({ ...data, organizationId, paidStatus: "Pending" });
  return newBill.save();
}
