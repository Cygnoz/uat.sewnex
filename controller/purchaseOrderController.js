const PurchaseOrder = require('../database/model/purchaseOrder');
const Organization = require('../database/model/organization');
const Item = require('../database/model/item');
const Supplier = require('../database/model/supplier');
const Customer = require('../database/model/customer');
const Settings = require("../database/model/settings")
const Tax = require('../database/model/tax');
const Prefix = require("../database/model/prefix");
const moment = require("moment-timezone");


// Fetch existing data
const dataExist = async (organizationId, supplierId, itemTable) => {
  const [organizationExists, supplierExists, items, taxExists, existingPrefix] = await Promise.all([
      Organization.findOne({ organizationId }),
      Supplier.findOne({ _id: supplierId }),
      // Promise.all(itemTable.map(item => Item.findOne({ _id: item.itemId }))),
      // Amal
      // Check if itemTable exists and is an array before mapping
      Array.isArray(itemTable) && itemTable.length > 0
        ? Promise.all(itemTable.map(item => Item.findOne({ _id: item.itemId })))
        : [],
        // Amal
      Tax.find({ organizationId }),
      Prefix.findOne({ organizationId })
  ]);
  // console.log("itemTable:", itemTable);
  return { organizationExists, supplierExists, items, taxExists, existingPrefix };
};


// Add a new purchase order
exports.addPurchaseOrder = async (req, res) => {
  const { supplierId, itemTable } = req.body;
  const { organizationId, id: userId, userName  } = req.user

  try {

    // Fetch existing data
    const { organizationExists, supplierExists, items, taxExists, existingPrefix } = await dataExist(organizationId, supplierId, itemTable);

    // Normalize request body to handle null, empty strings, and 0 values
    const normalizedBody = normalizeRequestData(req.body);

    // Perform validation checks using the refactored functions
    if (await hasValidationErrors(normalizedBody, supplierExists, res)) return;
    
    // Validate Inputs
    if (!validateInputs(organizationExists, supplierExists, items, taxExists, existingPrefix , res)) return;

    //Date & Time
    const openingDate = generateOpeningDate(organizationExists);

    //Tax Type
    taxtype(normalizedBody, supplierExists );

    const cleanedData =  cleanPurchaseOrderData(normalizedBody, supplierExists, items);

    // Check if transaction discount is valid
    if (cleanedData.transactionDiscountAmount > parseFloat(cleanedData.grandTotal)) {
      return res.status(400).json({ message: "Discount cannot exceed the grand total." });
    }

    // Verify itemTable fields with Item schema and supply locations
    if (!validateItemTable(items, itemTable, cleanedData, supplierExists, res)) return;


    // Validate location inputs
    if (!validateLocationInputs(cleanedData, organizationExists, res)) return;

     //Prefix
     await purchaseOrderPrefix(cleanedData, existingPrefix );

    // Create new purchase order
    const savedPurchaseOrder = await createNewPurchaseOrder(cleanedData, organizationId, userId, userName, openingDate);

    // Send success response
    res.status(201).json({ message: "Purchase order added successfully.", purchaseOrder: savedPurchaseOrder });
  } catch (error) {
    console.error("Error adding purchase order:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};


// Get All Purchase Orders
exports.getAllPurchaseOrders = async (req, res) => {
  // const { organizationId } = req.body;
  const {organizationId} = req.user
  try {

    // Check if an Organization already exists
    const { organizationExists } = await dataExist(organizationId);

    if (!organizationExists) {
      return res.status(404).json({
        message: "Organization not found",
      });
    }

    const purchaseOrders = await PurchaseOrder.find( {organizationId} );

    if (!purchaseOrders || purchaseOrders.length === 0) {
      return res.status(404).json({ message: "No purchase orders found." });
    }
    const PurchaseOrders = purchaseOrders.map((history) => {
      const { organizationId, ...rest } = history.toObject(); // Convert to plain object and omit organizationId
      return rest;
    });
    res.status(200).json({ PurchaseOrders });
  } catch (error) {
    console.error("Error fetching purchase orders:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};


//getPurchaseOrder
exports.getPurchaseOrder = async (req, res) => {
  try {
    const purchaseOrderId = req.params.id;
    // const { organizationId } = req.body;
    const {organizationId} = req.user

    // Check if an Organization already exists
    const { organizationExists } = await dataExist(organizationId);

    if (!organizationExists) {
      return res.status(404).json({
        message: "Organization not found",
      });
    }

    const purchaseOrder = await PurchaseOrder.findById({_id: purchaseOrderId});
    purchaseOrder.organizationId = undefined;
    if (purchaseOrder) {
      res.status(200).json(purchaseOrder);
    } else {
      res.status(404).json({ message: "Purchase order not found" });
    }
  } catch (error) {
    console.error("Error fetching a purchase order:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};




// Get Last Journal Prefix
exports. getLastPurchaseOrderPrefix = async (req, res) => {
  try {
      const organizationId = "INDORG0005";

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




// Normalize request body: convert null, empty strings, and 0 to undefined
const normalizeRequestData = (data) => {
  const normalizedData = {};

  Object.keys(data).forEach((key) => {
    const value = data[key];

    // If value is null, empty string, or 0, set to undefined
    if (value === null || value === "" || value === 0) {
      normalizedData[key] = undefined;
    } else {
      normalizedData[key] = value; // Otherwise, keep the value as is
    }
  });

  return normalizedData;
};





// Tax Type
function taxtype( cleanedData, supplierExists ) {
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
const validateItemTable = (items, itemTable, cleanedData, supplierExists, res) => {
  const { taxMode } = cleanedData;

  // Update the tax fields based on the supply locations
  itemTable.forEach(item => {
    if (taxMode === 'Intra') {
      item.itemIgst = undefined; // Same state, so no IGST
      item.itemIgstAmount = undefined;
    } else {
      item.itemCgst = undefined;
      item.itemSgst = undefined; // Different states, so no CGST and SGST
      item.itemCgstAmount = undefined;
      item.itemSgstAmount = undefined;
    }
    // console.log("table data.....",item);
  });

  const fieldsToCheck = supplierExists.taxType === 'GST' ? [
    { tableField: 'itemSgst', itemField: 'sgst', error: 'SGST mismatch' },
    { tableField: 'itemCgst', itemField: 'cgst', error: 'CGST mismatch' },
    { tableField: 'itemIgst', itemField: 'igst', error: 'IGST mismatch' }
  ] : [{ tableField: 'itemVat', itemField: 'vat', error: 'VAT mismatch' }];

  // Validate each item
  for (let i = 0; i < itemTable.length; i++) {
    const tableItem = itemTable[i];
    const dbItem = items[i];
    // console.log("item",dbItem);

    // Item name mismatch
    if (tableItem.itemName.trim() !== dbItem.itemName.trim())
      return res.status(400).json({ message: `Item name mismatch for itemId` });
  
    // Selling price mismatch
    if (parseFloat(tableItem.itemCostPrice) !== parseFloat(dbItem.costPrice))
      return res.status(400).json({ message: `Cost price mismatch for itemId` });
    
    // Tax mismatch based on the tax type and supply location
    for (const { tableField, itemField, error } of fieldsToCheck) {
      if (tableItem[tableField] !== undefined && dbItem[itemField] !== undefined && parseFloat(tableItem[tableField]) !== parseFloat(dbItem[itemField])) {
        return res.status(400).json({ message: `${error} for itemId` });
      }
    }

  }
  return true;  // If validation passes
};
   

// Clean data
const cleanPurchaseOrderData = (data, supplierExists, items) => {    
  const cleanData = value => (value == null || value === "" || value === 0 ? undefined : value);
  const { taxMode } = data;

  // Initialize overall totals
  let subTotal = 0; 
  let totalItem = 0;  
  let totalTaxAmount = 0;  
  let itemTotalDiscount = 0;

  // Clean data and calculate item-level totals 
  const cleanedData = { 
    ...data,
    itemTable: data.itemTable.map(item => {
      const cleanedItem = Object.keys(item).reduce((acc, key) => (acc[key] = cleanData(item[key]), acc), {});
      const isTaxable = items.some(i => i.taxPreference === 'Taxable');
      // console.log("Is any item taxable:", isTaxable);


      // Parse item quantities and prices
      const itemQuantity = parseInt(cleanedItem.itemQuantity) || 0;
      const itemCostPrice = parseFloat(cleanedItem.itemCostPrice) || 0;
      const itemDiscount = parseFloat(cleanedItem.itemDiscount) || 0;

      // Update subTotal and totalItem 
      subTotal += (itemQuantity * itemCostPrice).toFixed(2);
      totalItem += itemQuantity;

          if (cleanedItem.itemDiscountType === "percentage") {
            // Calculate the discount in percentage
            const discountAmount = (itemQuantity * itemCostPrice * itemDiscount) / 100;
            itemTotalDiscount += discountAmount; // Add to total discount
            cleanedItem.itemAmount = (itemQuantity * itemCostPrice - discountAmount).toFixed(2);
          } else if (cleanedItem.itemDiscountType === "currency") {
            // Calculate the discount in currency (absolute amount)
            itemTotalDiscount += itemDiscount; // Add to total discount
            cleanedItem.itemAmount = (itemQuantity * itemCostPrice - itemDiscount).toFixed(2);
          } else {
            // No discount applied
            cleanedItem.itemAmount = (itemQuantity * itemCostPrice).toFixed(2);
          }


      // Calculate tax amounts based on taxType
      if(isTaxable){
        if (supplierExists.taxType === "GST") {
          const itemIgstPercentage = parseFloat(cleanedItem.itemIgst) || 0; // Get IGST percentage
          // Convert IGST percentage to IGST amount
          const itemIgstAmount = (parseFloat(cleanedItem.itemAmount) * itemIgstPercentage) / 100;
          // console.log("itemIgstAmount",itemIgstAmount);
          if (taxMode === "Intra") {
            // For intra-state, split IGST amount into CGST and SGST
            const halfIgst = itemIgstAmount / 2;
            cleanedItem.itemCgstAmount = halfIgst.toFixed(2);
            cleanedItem.itemSgstAmount = halfIgst.toFixed(2);
            cleanedItem.itemTax = itemIgstAmount.toFixed(2); // Total tax is the IGST amount
            cleanedItem.itemIgstAmount = cleanedItem.itemIgst = undefined; // IGST should be undefined for intra-state
            totalTaxAmount += itemIgstAmount;  // Add to total tax
          } else {
            // For inter-state, assign the full IGST amount
            cleanedItem.itemIgstAmount = itemIgstAmount.toFixed(2);
            cleanedItem.itemTax = itemIgstAmount.toFixed(2); // Total tax is the IGST amount
            cleanedItem.itemCgstAmount = cleanedItem.itemCgst = undefined; // No CGST for inter-state
            cleanedItem.itemSgstAmount = cleanedItem.itemSgst = undefined; // No SGST for inter-state
            totalTaxAmount += itemIgstAmount;  // Add to total tax
          }
        } else if (supplierExists.taxType === "VAT") {
          const itemVatPercentage = parseFloat(cleanedItem.itemVat) || 0; // Get VAT percentage
          const itemVatAmount = (itemCostPrice * itemQuantity * itemVatPercentage) / 100;
          cleanedItem.itemTax = itemVatAmount.toFixed(2); // Calculate VAT amount
          cleanedItem.itemIgst = cleanedItem.itemCgst = cleanedItem.itemSgst = undefined; // Set IGST, CGST, SGST to undefined for VAT
          cleanedItem.itemIgstAmount = cleanedItem.itemCgstAmount = cleanedItem.itemSgstAmount = undefined; 
          totalTaxAmount += itemVatAmount;  // Add to total tax
        }
      } else {
        cleanedItem.itemIgst = cleanedItem.itemCgst = cleanedItem.itemSgst = cleanedItem.itemTax = undefined;
        cleanedItem.itemIgstAmount = cleanedItem.itemCgstAmount = cleanedItem.itemSgstAmount = undefined; 
      }

      // console.log("cleanedItem",cleanedItem);
      return cleanedItem;
    })
  };


  // Calculate roundOff, otherExpense, and freight (defaulting to 0 if not provided)
  const transactionDiscount = parseFloat(cleanedData.transactionDiscount) || 0;
  const roundOff = parseFloat(data.roundOff) || 0;
  const otherExpense = parseFloat(data.otherExpense) || 0;
  const freight = parseFloat(data.freight) || 0;

    // Divide totalTaxAmount based on taxMode
    if (taxMode === "Intra") {
      const halfTax = totalTaxAmount / 2;
      cleanedData.cgst = halfTax.toFixed(2);
      cleanedData.sgst = halfTax.toFixed(2);
      cleanedData.igst = undefined; // No IGST for intra-state
    } else if (taxMode === "Inter") {
      cleanedData.igst = totalTaxAmount.toFixed(2);
      cleanedData.cgst = undefined;
      cleanedData.sgst = undefined; // No CGST and SGST for inter-state
    } else if (taxMode === "VAT") {
      cleanedData.vat = totalTaxAmount.toFixed(2);
      cleanedData.igst = cleanedData.cgst = cleanedData.sgst = undefined; // Only VAT is applicable
    }

    // Add subTotal, totalItem, totalTaxAmount, and totalDiscount to cleanedData
    cleanedData.subTotal = subTotal;  // Overall subTotal
    cleanedData.totalItem = totalItem;  // Overall totalItem quantity
    cleanedData.totalTaxAmount = totalTaxAmount.toFixed(2);  // Total tax amount
    cleanedData.itemTotalDiscount = itemTotalDiscount.toFixed(2);  // Total discount

     // Calculate the grandTotal using the formula you provided
  const total = (
    (parseFloat(cleanedData.subTotal) +
    parseFloat(cleanedData.totalTaxAmount) +
    otherExpense +      
    freight -           
    roundOff) - itemTotalDiscount      
  ).toFixed(2);

    // Apply transaction discount based on its type (percentage or currency)
    if (cleanedData.transactionDiscountType === "percentage") {
      // If percentage, calculate percentage discount based on subTotal
      const transactionDiscountAmnt = (total * transactionDiscount) / 100;
      cleanedData.transactionDiscountAmount = transactionDiscountAmnt.toFixed(2);
    } else if (cleanedData.transactionDiscountType === "currency") {
      // If currency, apply the discount directly
      cleanedData.transactionDiscountAmount = transactionDiscount.toFixed(2);
    } 

    // Calculate grandTotal
    cleanedData.grandTotal = (total - parseFloat(cleanedData.transactionDiscountAmount)).toFixed(2);

  return cleanedData;
};





//Validate inputs
const validateInputs = (organizationExists, supplierExists, items, taxExists, existingPrefix, res) => {
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
  if (!taxExists) {
    res.status(404).json({ message: "No taxes found for the organization" });
    return false;
  }
  if (!existingPrefix) {
    res.status(404).json({ message: "Prefix not found" });
    return false;
  }
  return true; // All validations passed
};



// Validation Error Check
const hasValidationErrors = async (body, supplierExists, res) => {
  const { itemTable, transactionDiscountType } = body;

  let shipmentPreference = body.shipmentPreference; // Declare shipmentPreference with let
  let paymentMode = body.paymentMode; // Declare paymentMode with let

  // Normalize shipmentPreference and paymentMode: convert null, empty string, and 0 to undefined
  shipmentPreference = (shipmentPreference == null || shipmentPreference === "" || shipmentPreference === 0) ? undefined : shipmentPreference;
  paymentMode = (paymentMode == null || paymentMode === "" || paymentMode === 0) ? undefined : paymentMode;

  // Check for duplicate items in itemTable
  if (hasDuplicateItems(itemTable)) {
    res.status(400).json({ message: "Duplicate items found in the itemTable. Please ensure each item is added only once." });
    return true;
  }

  
  // Validate itemTable
  if (!Array.isArray(itemTable) || itemTable.length === 0) {
    res.status(400).json({ message: "Item table cannot be empty." });
    return true;
  }

   // Validate shipmentPreference 
   if (shipmentPreference && !validShipmentPreferences.includes(shipmentPreference)) {
    res.status(400).json({ message: "Invalid shipment preference." });
    return true;
  }

  // Validate paymentMode
  if (paymentMode && !validPaymentModes.includes(paymentMode)) {
    res.status(400).json({ message: "Invalid payment mode." });
    return true;
  }

  // Validate sourceOfSupply and destinationOfSupply if supplierExists.taxType === "GST"
  if (supplierExists && supplierExists.taxType === "GST") {
    if (!body.sourceOfSupply || body.sourceOfSupply.trim() === "") {
      res.status(400).json({ message: "sourceOfSupply is required." });
      return true;
    }
    if (!body.destinationOfSupply || body.destinationOfSupply.trim() === "") {
      res.status(400).json({ message: "destinationOfSupply is required." });
      return true;
    }
  } 

  // Validate itemDiscountType
  if (itemTable.some(item => !validItemDiscountTypes.includes(item.itemDiscountType))) {
    res.status(400).json({ message: "Invalid item discount type." });
    return true;
  }

  // Validate transactionDiscountType
  if (transactionDiscountType && !validTransactionDiscountTypes.includes(transactionDiscountType)) {
    res.status(400).json({ message: "Invalid transaction discount type." });
    return true;
  }

  return false; // No validation errors
};


// Function to check for duplicate items by itemId in itemTable
function hasDuplicateItems(itemTable) {
  const itemIds = itemTable.map(item => item.itemId);
  const uniqueItemIds = new Set(itemIds);
  return itemIds.length !== uniqueItemIds.size;
}



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



// Create new purchase order
async function createNewPurchaseOrder(data, organizationId, userId, userName, openingDate) {
  const newPurchaseOrder = new PurchaseOrder({ ...data, organizationId,  createdDate:openingDate, userId, userName, status: "Open"});
  return newPurchaseOrder.save();
}


//Return Date and Time 
function generateOpeningDate(organizationExists) {
  const date = generateTimeAndDateForDB(
      organizationExists.timeZoneExp,
      organizationExists.dateFormatExp,
      organizationExists.dateSplit
    )
  return date.dateTime;
}


// Function to generate time and date for storing in the database
function generateTimeAndDateForDB(
  timeZone,
  dateFormat,
  dateSplit,
  baseTime = new Date(),
  timeFormat = "HH:mm:ss",
  timeSplit = ":"
) {
  // Convert the base time to the desired time zone
  const localDate = moment.tz(baseTime, timeZone);

  // Format date and time according to the specified formats
  let formattedDate = localDate.format(dateFormat);

  // Handle date split if specified
  if (dateSplit) {
    // Replace default split characters with specified split characters
    formattedDate = formattedDate.replace(/[-/]/g, dateSplit); // Adjust regex based on your date format separators
  }

  const formattedTime = localDate.format(timeFormat);
  const timeZoneName = localDate.format("z"); // Get time zone abbreviation

  // Combine the formatted date and time with the split characters and time zone
  const dateTime = `${formattedDate} ${formattedTime
    .split(":")
    .join(timeSplit)} (${timeZoneName})`;

  return {
    date: formattedDate,
    time: `${formattedTime} (${timeZoneName})`,
    dateTime: dateTime,
  };
}


// Define valid shipment preferences, payment and modes discount types
const validShipmentPreferences = ["Road", "Rail", "Air", "Sea", "Courier", "Hand Delivery", "Pickup"];
const validPaymentModes = ["Cash", "Credit"];
const validItemDiscountTypes = ["percentage", "currency"];
const validTransactionDiscountTypes = ["percentage", "currency"];
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




