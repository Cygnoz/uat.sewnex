const PurchaseBill = require('../database/model/bills');
const PurchaseOrder = require('../database/model/purchaseOrder');
const Organization = require('../database/model/organization');
const Supplier = require('../database/model/supplier');
const Item = require('../database/model/item');
const Settings = require("../database/model/settings");
const ItemTrack = require("../database/model/itemTrack");
const Tax = require('../database/model/tax');  // Add tax model

// Fetch existing data including tax and settings
const dataExistForBill = async (organizationId, supplierId, itemTable, orderNumber) => {
  const [organizationExists, supplierExists, purchaseOrderExists, items, settings, taxDetails] = await Promise.all([
    Organization.findOne({ organizationId }),
    Supplier.findOne({ _id: supplierId }),
    PurchaseOrder.findOne({ orderNumber, organizationId }),
    Promise.all(itemTable.map(item => Item.findOne({ _id: item.itemId }))),
    Settings.findOne({ organizationId }),
    Tax.findOne({ organizationId }) // Fetch tax details for the organization
  ]);
  return { organizationExists, supplierExists, purchaseOrderExists, items, settings, taxDetails };
};

// Add a new bill
exports.addBill = async (req, res) => {
  console.log("Add purchase bill:", req.body);

  const { organizationId, supplierId, itemTable, billDate, orderNumber, ...otherDetails } = req.body;

  try {
    // Clean Data
    const cleanedData = cleanBillData(req.body);

    // Fetch existing data including tax and settings
    const { organizationExists, supplierExists, items, settings, taxDetails } = await dataExistForBill(organizationId, supplierId, itemTable, orderNumber);

    // Validate Inputs
    if (!validateBillInputs(organizationExists, supplierExists, items, settings, taxDetails, res)) return;

    

    // Check for existing bill
    if (await checkExistingBill(cleanedData.billNumber, organizationId, res)) return;

    // **Tax Calculation & Validation Logic** - GST/VAT Calculation for taxable items
    for (let i = 0; i < items.length; i++) {
      const currentItem = items[i];
      const billItem = itemTable[i];
      const itemPrice = billItem.itemPrice;
 
      // Determine source and destination of supply
      const { sourceOfSupply, destinationOfSupply } = cleanedData; // Ensure these fields are in the cleanedData

      // Tax calculations based on tax type (GST or VAT)
      if (taxDetails.taxType === "GST") {

       // Determine if the source of supply and destination of supply are the same
        const isInterState = sourceOfSupply !== destinationOfSupply;
        
        const gstTaxRate = taxDetails.gstTaxRate[0]; // Get the GST rate from the tax details

        // Calculate GST
        const gstCalculation = calculateGST(itemPrice, gstTaxRate.taxRate, isInterState);

        // Update billItem with calculated GST details
        if (isInterState) {
          billItem.itemIgst = gstCalculation.igst;
        } else {
          billItem.itemCgst = gstCalculation.cgst;
          billItem.itemSgst = gstCalculation.sgst;
        }

        // Ensure GST fields are valid
        if (!billItem.itemSgst && !billItem.itemCgst && !billItem.itemIgst) {
          return res.status(400).json({ message: `GST details missing for item: ${currentItem.itemName}` });
        }

      } else if (taxDetails.taxType === "VAT") {
        const vatTaxRate = taxDetails.vatTaxRate[0]; // Get the VAT rate from the tax details

        // Calculate VAT
        const vatCalculation = calculateVAT(itemPrice, vatTaxRate.taxRate);

        // Update billItem with calculated VAT details
        billItem.itemVat = vatCalculation.vat;

        // Ensure VAT field is valid
        if (!billItem.itemVat) {
          return res.status(400).json({ message: `VAT details missing for item: ${currentItem.itemName}` });
        }
      }
    }

    // Create new bill
    const savedBill = await createNewBill(cleanedData, organizationId);

    // Track the items from the bill
    await trackItemsFromBill(organizationId, itemTable, billDate, savedBill);

    // Send success response
    res.status(201).json({ message: "Bill added successfully.", bill: savedBill });
  } catch (error) {
    console.error("Error adding bill:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// GST Calculation
function calculateGST(itemPrice, gstRate, isInterState) {
  let cgst = 0, sgst = 0, igst = 0, totalTax = 0;

  if (isInterState) {
    // For Inter-state sales, apply IGST
    igst = (gstRate / 100) * itemPrice;
    totalTax = igst;
  } else {
    // For Intra-state sales, apply CGST + SGST
    cgst = (gstRate / 2 / 100) * itemPrice;
    sgst = (gstRate / 2 / 100) * itemPrice;
    totalTax = cgst + sgst;
  }

  const totalPrice = itemPrice + totalTax;
  return { cgst, sgst, igst, totalTax, totalPrice };
}

// VAT Calculation
function calculateVAT(itemPrice, vatRate) {
  const vat = (vatRate / 100) * itemPrice;
  const totalPrice = itemPrice + vat;
  return { vat, totalPrice };
}

// Clean data for bill
function cleanBillData(data) {
  const cleanData = (value) => (value === null, value === undefined, value === "" || value === 0 ? undefined : value);
  return Object.keys(data).reduce((acc, key) => {
    acc[key] = cleanData(data[key]);
    return acc;
  }, {});
}

// Validate inputs for bill, including settings validation
function validateBillInputs(organizationExists, supplierExists, items, settings, taxDetails, res) {
  if (!organizationExists) {
    res.status(404).json({ message: "Organization not found" });
    return false; 
  }
  if (!supplierExists) {
    res.status(404).json({ message: "Supplier not found" });
    return false;
  }
  if (items.some(item => !item)) {
    res.status(404).json({ message: "Items not found" });
    return false;
  }
  if (!settings) {
    res.status(404).json({ message: "Settings not found for this organization." });
    return false;
  }
  if (!taxDetails) {
    res.status(404).json({ message: "Tax details not found for this organization." });
    return false;
  }
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

// Add purchased items from the bill to item tracking
const trackItemsFromBill = async (organizationId, itemTable, billDate, savedBill) => {
  for (const billItem of itemTable) {
    const { itemId, itemName, itemQuantity } = billItem;

    // Find the item to update its stock (credit the quantity from the bill)
    const savedItem = await Item.findOne({ _id: itemId, organizationId });

    if (savedItem) {
      const newStock = (savedItem.currentStock || 0) + Number(itemQuantity);
      console.log(`Processing item: ${itemName}`);

      const trackEntry = new ItemTrack({
        organizationId,
        operationId: savedBill._id,
        action: "Purchase",
        date: billDate,
        itemId: savedItem._id,
        itemName: savedItem.itemName,
        creditQuantity: Number(itemQuantity),
        currentStock: newStock,
        remark: `Bill of ${itemQuantity} units`,
      });

      await trackEntry.save();
      savedItem.currentStock = newStock;
      await savedItem.save();

      console.log("Item Track Added for Bill:", trackEntry);
    } else {
      console.log(`Item with ID ${itemId} not found.`);
    }
  }
};
