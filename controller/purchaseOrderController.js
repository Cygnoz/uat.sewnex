const PurchaseOrder = require('../database/model/purchaseOrder');
const Organization = require('../database/model/organization');
const Item = require('../database/model/item');
const Supplier = require('../database/model/supplier');
const Customer = require('../database/model/customer');
const Settings = require("../database/model/settings")
const Tax = require('../database/model/tax');
const Prefix = require("../database/model/prefix");



// Fetch existing data
const dataExist = async (organizationId, supplierId, customerId, itemTable) => {
  const [organizationExists, supplierExists, customerExists, items, taxExists, existingPrefix] = await Promise.all([
      Organization.findOne({ organizationId }),
      Supplier.findOne({ _id: supplierId }),
      Customer.findOne({ _id: customerId }),
      Promise.all(itemTable.map(item => Item.findOne({ _id: item.itemId }))),
      Tax.find({ organizationId }),
      Prefix.findOne({ organizationId })

  ]);
  // console.log("itemTable:", itemTable);
  return { organizationExists, supplierExists, customerExists, items, taxExists, existingPrefix };
};

// Define valid shipment preferences, payment and modes discount types
const validShipmentPreferences = ["Road", "Rail", "Air", "Sea", "Courier", "Hand Delivery", "Pickup"];
const validPaymentModes = ["Cash", "Credit Card", "Debit Card", "Bank Transfer", "UPI", "PayPal"];
const validDiscountTypes = ["Item line", "Transaction line", "Both"];
// const validItemDiscountTypes = ["percentage", "currency"];
// const validTransactionDiscountTypes = ["percentage", "currency"];

// Add a new purchase order
exports.addPurchaseOrder = async (req, res) => {
  const { organizationId, supplierId, customerId, itemTable, taxType, shipmentPreference, paymentMode, sourceOfSupply, destinationOfSupply, discountType, transactionDiscountType, itemDiscountType, ...otherDetails } = req.body;
  console.log("req body:", req.body);
  try {
    // Validate shipmentPreference
    if (!validShipmentPreferences.includes(shipmentPreference)) {
      return res.status(400).json({ message: "Invalid shipment preference." });
    }

    // Validate paymentMode
    if (!validPaymentModes.includes(paymentMode)) {
      return res.status(400).json({ message: "Invalid payment mode." });
    }

    // Validate discountType
    if (!validDiscountTypes.includes(discountType)) {
      return res.status(400).json({ message: "Invalid discount type." });
    }

    // // Validate itemDiscountType and transactionDiscountType
    // if (itemTable.some(item => !validItemDiscountTypes.includes(item.itemDiscountType))) {
    //   return res.status(400).json({ message: "Invalid item discount type." });
    // }
    // if (transactionDiscountType && !validTransactionDiscountTypes.includes(transactionDiscountType)) {
    //   return res.status(400).json({ message: "Invalid transaction discount type." });
    // }

    

    // Clean Data
    const cleanedData = cleanPurchaseOrderData(req.body, taxtype);
    // console.log("cleanPurchaseOrderData",cleanPurchaseOrderData);

    // Fetch existing data
    const { organizationExists, supplierExists, customerExists, items, taxExists, existingPrefix } = await dataExist(organizationId, supplierId, customerId, itemTable);

    // Validate Inputs
    if (!validateInputs(organizationExists, supplierExists, customerExists, items, taxExists, res)) return;

    //Tax Type
    taxtype(cleanedData, supplierExists );

    // Validate location inputs
    if (!validateLocationInputs(cleanedData, organizationExists, res)) return;

    // Set taxMode based on supply locations
    // cleanedData.taxMode = sourceOfSupply === destinationOfSupply ? 'intra' : 'inter';

    // Verify itemTable fields with Item schema and supply locations
    if (!validateItemTable(items, itemTable, taxType, cleanedData, res)) return;

    // Check for existing purchase order
    // if (await checkExistingPurchaseOrder(cleanedData.purchaseOrder, organizationId, res)) return;

    // console.log("Cleaned Data1:", cleanedData);

     //Prefix
     await purchaseOrderPrefix(cleanedData, existingPrefix );

    // Create new purchase order
    const savedPurchaseOrder = await createNewPurchaseOrder(cleanedData, organizationId);

    // Send success response
    res.status(201).json({ message: "Purchase order added successfully.", purchaseOrder: savedPurchaseOrder });
  } catch (error) {
    console.error("Error adding purchase order:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};



// Get Last Journal Prefix
exports.getLastPurchaseOrderPrefix = async (req, res) => {
  try {
      const organizationId = "INDORG0001";

      // Find all accounts where organizationId matches
      const prefix = await Prefix.findOne({ organizationId:organizationId,'series.status': true });

      if (!prefix) {
          return res.status(404).json({
              message: "No Prefix found for the provided organization ID.",
          });
      }
      
      const series = prefix.series[0];     
      const lastPrefix = series.purchaseOrder + series.purchaseOrderNum;

      res.status(200).json(lastPrefix);
  } catch (error) {
      console.error("Error fetching accounts:", error);
      res.status(500).json({ message: "Internal server error." });
  }
};

// Purchase Prefix
function purchaseOrderPrefix( cleanData, existingPrefix ) {
  const activeSeries = existingPrefix.series.find(series => series.status === true);
  if (!activeSeries) {
      return res.status(404).json({ message: "No active series found for the organization." });
  }
  cleanData.purchaseOrder = `${activeSeries.purchaseOrder}${activeSeries.purchaseOrderNum}`;

  activeSeries.purchaseOrderNum += 1;

  existingPrefix.save()

  return 
}





// Tax Type
function taxtype( cleanedData, supplierExists ) {
  // Set taxMode based on taxType and supply locations
  // let taxMode;
  if(supplierExists.taxType === 'GST' ){
    if(cleanedData.sourceOfSupply === cleanedData.destinationOfSupply){
      cleanedData.taxMode ='Intra';
    }
    else{
      cleanedData.taxMode ='Inter';
    }
  }
  if(supplierExists.taxType === 'VAT' ){
    cleanedData.taxMode ='VAT'; 
  }
  if(supplierExists.taxType === 'Non-Tax' ){
    cleanedData.taxMode ='Non-Tax';
  } 
  return  
}

// Validate item table based on taxType
const validateItemTable = (items, itemTable, data, res) => {
  const { sourceOfSupply, destinationOfSupply } = data;

  // Check if sourceOfSupply and destinationOfSupply are from the same state
  const isSameState = sourceOfSupply === destinationOfSupply;

  // Update the tax fields based on the supply locations
  itemTable.forEach(item => {
    if (isSameState) {
      item.itemIgst = undefined; // Same state, so no IGST
    } else {
      item.itemCgst = undefined;
      item.itemSgst = undefined; // Different states, so no CGST and SGST
    }
  });

  // const fieldsToCheck = taxType === 'GST' ? [
  //   { tableField: 'itemSgst', itemField: 'sgst', error: 'SGST mismatch' },
  //   { tableField: 'itemCgst', itemField: 'cgst', error: 'CGST mismatch' },
  //   { tableField: 'itemIgst', itemField: 'igst', error: 'IGST mismatch' }
  // ] : [{ tableField: 'itemVat', itemField: 'vat', error: 'VAT mismatch' }];

  // Validate each item
  for (let i = 0; i < itemTable.length; i++) {
    const tableItem = itemTable[i];
    const dbItem = items[i];

    // Item name mismatch
    if (tableItem.itemName.trim() !== dbItem.itemName.trim())
      return res.status(400).json({ message: `Item name mismatch for itemId` });

    // Selling price mismatch
    if (parseFloat(tableItem.itemSellingPrice) !== parseFloat(dbItem.sellingPrice))
      return res.status(400).json({ message: `Selling price mismatch for itemId` });

  //   // Tax mismatch based on the tax type and supply location
  //   for (const { tableField, itemField, error } of fieldsToCheck) {
  //     if (tableItem[tableField] !== undefined && dbItem[itemField] !== undefined && parseFloat(tableItem[tableField]) !== parseFloat(dbItem[itemField])) {
  //       return res.status(400).json({ message: `${error} for itemId` });
  //     }
  //   }
  }
  return true;  // If validation passes
};



   

// Clean data
const cleanPurchaseOrderData = (data) => {
  console.log("data",data);
  const cleanData = value => (value == null || value === "" || value === 0 ? undefined : value);
  const { discountType, taxMode } = data;

  // Initialize cleanedData first
  let subTotal = 0;  // Overall subtotal
  let totalItem = 0;  // Overall total quantity
  let totalTaxAmount = 0;  // Overall tax amount
  let totalDiscount = 0;  // Overall discount amount

  // Initialize cleanedData first
  const cleanedData = { 
    ...data, 
    taxMode,
    supplierExists,
    itemTable: data.itemTable.map(item => {
      const cleanedItem = Object.keys(item).reduce((acc, key) => (acc[key] = cleanData(item[key]), acc), {});

      console.log("supplierExists......",taxMode);

      
      // Parse item quantities and prices
      const itemQuantity = parseFloat(cleanedItem.itemQuantity) || 0;
      const itemSellingPrice = parseFloat(cleanedItem.itemSellingPrice) || 0;
      const itemDiscount = parseFloat(cleanedItem.itemDiscount) || 0;

      // Update subTotal and totalItem
      subTotal += itemQuantity * itemSellingPrice;
      totalItem += itemQuantity;

      // Calculate the itemAmount if it's not already provided
      if (!cleanedItem.itemAmount) {
        // Discount calculation for Item Line discounts and Both
        if (discountType === "Item line" || discountType === "Both") {
          if (cleanedItem.itemDiscountType === "percentage") {
            // Calculate the discount in percentage
            const discountAmount = (itemQuantity * itemSellingPrice * itemDiscount) / 100;
            totalDiscount += discountAmount; // Add to total discount
            cleanedItem.itemAmount = (itemQuantity * itemSellingPrice - discountAmount).toFixed(2);
          } else if (cleanedItem.itemDiscountType === "currency") {
            // Calculate the discount in currency (absolute amount)
            totalDiscount += itemDiscount; // Add to total discount
            cleanedItem.itemAmount = (itemQuantity * itemSellingPrice - itemDiscount).toFixed(2);
          } else {
            // No discount applied
            cleanedItem.itemAmount = (itemQuantity * itemSellingPrice).toFixed(2);
          }
        } 
      }

      // Calculate tax amounts based on taxType
      if (supplierExists.taxType === "GST") {
        const itemIgstPercentage = parseFloat(cleanedItem.itemIgst) || 0; // Get IGST percentage

        // Convert IGST percentage to IGST amount
        // const itemIgstAmount = (itemSellingPrice * itemQuantity * itemIgstPercentage) / 100;
        // **Updated Calculation**: Use itemAmount instead of itemSellingPrice * itemQuantity
        const itemIgstAmount = (parseFloat(cleanedItem.itemAmount) * itemIgstPercentage) / 100;
        console.log("itemIgstAmount",itemIgstAmount);

        if (taxMode === "intra") {
          // For intra-state, split IGST amount into CGST and SGST
          const halfIgst = itemIgstAmount / 2;
          cleanedItem.itemCgst = halfIgst.toFixed(2);
          cleanedItem.itemSgst = halfIgst.toFixed(2);
          cleanedItem.itemTax = itemIgstAmount.toFixed(2); // Total tax is the IGST amount
          cleanedItem.itemIgst = undefined; // IGST should be undefined for intra-state
          totalTaxAmount += itemIgstAmount;  // Add to total tax
        } else {
          // For inter-state, assign the full IGST amount
          cleanedItem.itemIgst = itemIgstAmount.toFixed(2);
          cleanedItem.itemTax = itemIgstAmount.toFixed(2); // Total tax is the IGST amount
          cleanedItem.itemCgst = undefined; // No CGST for inter-state
          cleanedItem.itemSgst = undefined; // No SGST for inter-state
          totalTaxAmount += itemIgstAmount;  // Add to total tax
        }
      } else if (supplierExists.taxType === "VAT") {
        const itemVatPercentage = parseFloat(cleanedItem.itemVat) || 0; // Get VAT percentage
        const itemVatAmount = (itemSellingPrice * itemQuantity * itemVatPercentage) / 100;
        cleanedItem.itemTax = itemVatAmount.toFixed(2); // Calculate VAT amount
        cleanedItem.itemIgst = cleanedItem.itemCgst = cleanedItem.itemSgst = undefined; // Set IGST, CGST, SGST to undefined for VAT
        totalTaxAmount += itemVatAmount;  // Add to total tax
      }

      // Handle taxMode
      if (taxMode === 'intra') {
        cleanedItem.itemIgst = undefined; // Same state, no IGST
      } else {
        cleanedItem.itemCgst = cleanedItem.itemSgst = undefined; // Different states, no CGST/SGST
      }
      
      console.log("cleanedItem",cleanedItem);

      return cleanedItem;
    })
  };

  const transactionDiscount = parseFloat(cleanedData.transactionDiscount) || 0;
  // Calculate roundOff, otherExpense, and freight (defaulting to 0 if not provided)
  const roundOff = parseFloat(data.roundOff) || 0;
  const otherExpense = parseFloat(data.otherExpense) || 0;
  const freight = parseFloat(data.freight) || 0;

    // // Calculate the beforeTaxDiscountAmount if it's not already provided
    // if (!cleanedData.beforeTaxDiscountAmount) {
    //   // Discount calculation for Transaction Line discounts and Both
    //   if (discountType === "Transaction line" || discountType === "Both") {
    //     if (cleanedData.transactionDiscountType === "percentage") {
    //       // Calculate the discount in percentage
    //       const transactionDiscountAmnt = (subTotal * transactionDiscount) / 100;
    //       totalDiscount += transactionDiscountAmnt; // Add transaction discount amount
    //       cleanedData.beforeTaxDiscountAmount = (subTotal - transactionDiscountAmnt).toFixed(2);
    //     } else if (cleanedData.transactionDiscountType === "currency") {
    //       // Calculate the discount in currency (absolute amount)
    //       totalDiscount += transactionDiscount; // Add transaction discount
    //       cleanedData.beforeTaxDiscountAmount = (subTotal - transactionDiscount).toFixed(2);
    //     } else {
    //       // No discount applied
    //       cleanedData.beforeTaxDiscountAmount = subTotal.toFixed(2);
    //     }
    //   } 
    // }

    // Apply transaction discount based on its type (percentage or currency)
    if (cleanedData.transactionDiscountType === "percentage") {
      // If percentage, calculate percentage discount based on subTotal
      const transactionDiscountAmnt = (subTotal * transactionDiscount) / 100;
      totalDiscount += transactionDiscountAmnt;  // Add to total discount
      cleanedData.transactionDiscountAmount = transactionDiscountAmnt.toFixed(2);
    } else if (cleanedData.transactionDiscountType === "currency") {
      // If currency, apply the discount directly
      totalDiscount += transactionDiscount;
      cleanedData.transactionDiscountAmount = transactionDiscount.toFixed(2);
    }

    // Calculate beforeTaxDiscountAmount
    if (!cleanedData.beforeTaxDiscountAmount) {
      cleanedData.beforeTaxDiscountAmount = (subTotal - totalDiscount).toFixed(2);
    }

    // Divide totalTaxAmount based on taxMode
    if (taxMode === "intra") {
      const halfTax = totalTaxAmount / 2;
      cleanedData.cgst = halfTax.toFixed(2);
      cleanedData.sgst = halfTax.toFixed(2);
      cleanedData.igst = undefined; // No IGST for intra-state
    } else if (taxMode === "inter") {
      cleanedData.igst = totalTaxAmount.toFixed(2);
      cleanedData.cgst = undefined;
      cleanedData.sgst = undefined; // No CGST and SGST for inter-state
    } else if (taxMode === "VAT") {
      cleanedData.vat = totalTaxAmount.toFixed(2);
      cleanedData.igst = cleanedData.cgst = cleanedData.sgst = undefined; // Only VAT is applicable
    }

    // Add subTotal, totalItem, totalTaxAmount, and totalDiscount to cleanedData
    cleanedData.subTotal = subTotal.toFixed(2);  // Overall subTotal
    cleanedData.totalItem = totalItem;  // Overall totalItem quantity
    cleanedData.totalTaxAmount = totalTaxAmount.toFixed(2);  // Total tax amount
    cleanedData.totalDiscount = totalDiscount.toFixed(2);  // Total discount

    // Calculate AfterTaxDiscountAmount
    cleanedData.afterTaxDiscountAmount = (subTotal + totalTaxAmount - totalDiscount).toFixed(2);

    // Calculate the grandTotal
    cleanedData.grandTotal = (
      parseFloat(cleanedData.afterTaxDiscountAmount) +
      roundOff +
      otherExpense +
      freight
    ).toFixed(2);

    console.log("Cleaned Data:", cleanedData);
  return cleanedData;
};








// Validate inputs
const validateInputs = (organizationExists, supplierExists, customerExists, items, taxExists, existingPrefix, res) => {
  if (!organizationExists) 
    return res.status(404).json({ message: "Organization not found" });
  if (!supplierExists) 
    return res.status(404).json({ message: "Supplier not found" });
  if (!customerExists) 
    return res.status(404).json({ message: "Customer not found" });
  if (items.some(item => !item)) 
    return res.status(404).json({ message: "Items not found" });
  if (!taxExists.length) 
    return res.status(404).json({ message: "No taxes found for the organization" });
  if (!existingPrefix) 
    return res.status(404).json({ message: "Prefix not found" });
  return true;
};



//Validate location inputs
function validateLocationInputs(data, organizationExists, res) {
  const validationErrors = validateSupplyLocations(data, organizationExists);
  if (validationErrors.length > 0) {
    res.status(400).json({ message: validationErrors.join(", ") });
    return false;
  }
  return true;
}

// Function to validate both sourceOfSupply and destinationOfSupply
function validateSupplyLocations( data, organization) {
  const errors=[];

  // Validate sourceOfSupply
  validateSourceOfSupply(data.sourceOfSupply, organization, errors);

  // Validate destinationOfSupply
  validateDestinationOfSupply(data.destinationOfSupply, organization, errors);

  return errors; // Return the errors array
}

// Validate Source of Supply
function validateSourceOfSupply(sourceOfSupply, organization, errors) {
  // console.log("sourceofsupply",sourceOfSupply,organization)
  if (sourceOfSupply && !validCountries[organization.organizationCountry]?.includes(sourceOfSupply)) {
    errors.push("Invalid Source of Supply: " + sourceOfSupply);
  }
}

// Validate Destination of Supply
function validateDestinationOfSupply(destinationOfSupply, organization, errors) {
  if (destinationOfSupply && !validCountries[organization.organizationCountry]?.includes(destinationOfSupply)) {
    errors.push("Invalid Destination of Supply: " + destinationOfSupply);
  }
}



// Check for existing purchase order
async function checkExistingPurchaseOrder(purchaseOrder, organizationId, res) {
  const existingPurchaseOrder = await PurchaseOrder.findOne({ purchaseOrder, organizationId });
  if (existingPurchaseOrder) {
      res.status(409).json({ message: "Purchase order already exists." });
      return true; // Indicate that a duplicate exists
  }
  return false; // No duplicate found
}

// Create new purchase order
async function createNewPurchaseOrder(data, organizationId) {
  const newPurchaseOrder = new PurchaseOrder({ ...data, organizationId, status: "Open" });
  return newPurchaseOrder.save();
}



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




