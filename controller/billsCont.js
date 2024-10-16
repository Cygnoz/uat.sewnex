const PurchaseBill = require('../database/model/bills');
const PurchaseOrder = require('../database/model/purchaseOrder');
const Organization = require('../database/model/organization');
const Supplier = require('../database/model/supplier');
const Item = require('../database/model/item');
const Settings = require("../database/model/settings");
const ItemTrack = require("../database/model/itemTrack");
const Tax = require('../database/model/tax');  // Add tax model

const dataExistForBill = async (organizationId, supplierId, itemTable, orderNumber) => {
  const [organizationExists, supplierExists, purchaseOrderExists, items, settings, taxDetails] = await Promise.all([
    Organization.findOne({ organizationId }),
    Supplier.findOne({ _id: supplierId }),
    PurchaseOrder.findOne({ orderNumber, organizationId }),
    // Fetch item details from Item schema using itemId
    Promise.all(itemTable.map(item => Item.findOne({ _id: item.itemId }))),
    Settings.findOne({ organizationId }),
    Tax.findOne({ organizationId }) // Fetch tax details for the organization
  ]);

  return { organizationExists, supplierExists, purchaseOrderExists, items, settings, taxDetails };
};

exports.addBill = async (req, res) => {
  console.log("Add purchase bill:", req.body);

  const { organizationId, supplierId, itemTable, billDate, orderNumber, taxMode, ...otherDetails } = req.body;

  try {
    // Clean Data
    const cleanedData = cleanBillData(req.body);

    // Fetch existing data including tax and settings
    const { organizationExists, supplierExists, items, settings, taxDetails } = await dataExistForBill(organizationId, supplierId, itemTable, orderNumber);

    // Validate Inputs
    if (!validateBillInputs(organizationExists, supplierExists, items, settings, taxDetails, res)) return;
    if (!validateInputs(cleanedData, organizationExists, res)) return;

    // Check for existing bill
    if (await checkExistingBill(cleanedData.billNumber, organizationId, res)) return;

    let subTotal = 0;
    let totalTaxAmount = 0;

    // Map fetched item details from itemschema to the itemTable fields
    for (let i = 0; i < items.length; i++) {
      const billItem = itemTable[i];
      const fetchedItem = items[i];

      // Fill in the itemTable fields using the fetched data
      billItem.itemproduct = fetchedItem.itemName;  // itemname in itemSchema
      billItem.itemsellingprice = fetchedItem.sellingPrice;  // sellingprice in itemSchema
      billItem.itemcgst = fetchedItem.cgst;  // cgst in itemSchema
      billItem.itemsgst = fetchedItem.sgst;  // sgst in itemSchema
      billItem.itemigst = fetchedItem.igst;  // igst in itemSchema
      billItem.itemvat = fetchedItem.vat;  // vat in itemSchema

      const itemPrice = parseFloat(billItem.itemsellingprice || 0);
      const itemQuantity = parseFloat(billItem.itemQuantity || 1);
      const itemAmount = itemPrice * itemQuantity;

      // Calculate item amount (rate * quantity / discount if applicable)
      billItem.itemAmount = (itemAmount).toFixed(2);

      // Tax Calculation & Validation Logic
      let cgst = 0, sgst = 0, igst = 0, vat = 0;
      if (taxDetails.taxType === "GST") {
        const gstRate = taxDetails.gstTaxRate[0].taxRate;
        const isInterState = taxMode === 'inter';
        const { cgst, sgst, igst, totalTax } = calculateGST(itemAmount, gstRate, isInterState);
        
        // Example usage of totalTax:
        console.log(`Total tax for this item is: ${totalTax}`);

        billItem.itemCgst = cgst.toFixed(2);
        billItem.itemSgst = sgst.toFixed(2);
        billItem.itemIgst = igst.toFixed(2);
      } else if (taxDetails.taxType === "VAT") {
        const vatRate = taxDetails.vatTaxRate[0].taxRate;
        const { vat } = calculateVAT(itemAmount, vatRate);
        billItem.itemVat = vat.toFixed(2);
      }

      subTotal += itemAmount;
      totalTaxAmount += cgst + sgst + igst + vat;
    }

    const grandTotal = subTotal + totalTaxAmount + parseFloat(cleanedData.otherExpense || 0) + parseFloat(cleanedData.freight || 0);

    // Update cleanedData with calculated values
    cleanedData.subTotal = subTotal.toFixed(2);
    cleanedData.totalTaxAmount = totalTaxAmount.toFixed(2);
    cleanedData.grandTotal = grandTotal.toFixed(2);

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
    igst = (gstRate / 100) * itemPrice;
    totalTax = igst;
  } else {
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
  const cleanData = (value) => (value === null || value === undefined || value === "" || value === 0 ? undefined : value);

  return Object.keys(data).reduce((acc, key) => {
    // Exclude these fields from being cleaned to avoid undefined when empty
    const excludeFields = ['grandTotal', 'subTotal', 'itemProduct', 'itemSellingPrice', 'itemAmount', 'itemSgst', 'itemCgst', 'itemIgst', 'itemVat', 'totalItem'];

    if (excludeFields.includes(key)) {
      acc[key] = data[key]; // Keep their original value
    } else {
      acc[key] = cleanData(data[key]);
    }
    return acc;
  }, {});
}


// // Clean data for bill
// function cleanBillData(data) {
//   const cleanData = (value) => (value === null || value === undefined || value === "" || value === 0 ? undefined : value);
  
//   return Object.keys(data).reduce((acc, key) => {
//     // Exclude grandTotal and subTotal from being cleaned to avoid undefined when empty
//     if (key === 'grandTotal' || key === 'subTotal') {
//       acc[key] = data[key]; // Keep their original value
//     } else {
//       acc[key] = cleanData(data[key]);
//     }
//     return acc;
//   }, {});
// }

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

// Validate supply locations
function validateInputs(data, organizationExists, res) {
  const validationErrors = validateSupplyLocations(data, organizationExists);

  if (validationErrors.length > 0) {
    res.status(400).json({ message: validationErrors.join(", ") });
    return false;
  }
  return true;
}

// Validate source and destination of supply
function validateSupplyLocations(data, organization) {
  const errors = [];
  validateSourceOfSupply(data.sourceOfSupply, organization, errors);
  validateDestinationOfSupply(data.destinationOfSupply, organization, errors);
  return errors;
}

function validateSourceOfSupply(sourceOfSupply, organization, errors) {
  if (sourceOfSupply && !validCountries[organization.organizationCountry]?.includes(sourceOfSupply)) {
    errors.push("Invalid Source of Supply: " + sourceOfSupply);
  }
}

function validateDestinationOfSupply(destinationOfSupply, organization, errors) {
  if (destinationOfSupply && !validCountries[organization.organizationCountry]?.includes(destinationOfSupply)) {
    errors.push("Invalid Destination of Supply: " + destinationOfSupply);
  }
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

// Track purchased items from the bill
const trackItemsFromBill = async (organizationId, itemTable, billDate, savedBill) => {
  for (const billItem of itemTable) {
    const { itemId, itemName, itemQuantity } = billItem;
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
      console.error(`Item not found: ${itemId}`);
    }
  }
};

const validCountries = {
  "United Arab Emirates": [
    "Abu Dhabi",
    "Dubai",
    "Sharjah",
    "Ajman",
    "Umm Al-Quwain",
    "Fujairah",
    "Ras Al Khaimah",
  ],
  "India": [
    "Andaman and Nicobar Island",
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chandigarh",
    "Chhattisgarh",
    "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jammu and Kashmir",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Ladakh",
    "Lakshadweep",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Puducherry",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
  ],
  "Saudi Arabia": [
    "Asir",
    "Al Bahah",
    "Al Jawf",
    "Al Madinah",
    "Al-Qassim",
    "Eastern Province",
    "Hail",
    "Jazan",
    "Makkah",
    "Medina",
    "Najran",
    "Northern Borders",
    "Riyadh",
    "Tabuk",
  ],
};