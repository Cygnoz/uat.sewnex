const PurchaseBill = require('../database/model/bills');
const PurchaseOrder = require('../database/model/purchaseOrder');
const Organization = require('../database/model/organization');
const Supplier = require('../database/model/supplier');
const Item = require('../database/model/item');
const Settings = require("../database/model/settings");
const ItemTrack = require("../database/model/itemTrack");
const Tax = require('../database/model/tax');  // Add tax model
const moment = require("moment-timezone");



const dataExistForBill = async (organizationId, supplierId, itemTable, orderNumber) => {
  const [organizationExists, supplierExists, purchaseOrderExists, items, settings, taxExists , existingPrefix] = await Promise.all([
    Organization.findOne({ organizationId }),
    Supplier.findOne({ _id: supplierId }),
    PurchaseOrder.findOne({ orderNumber, organizationId }),
    // Fetch item details from Item schema using itemId
    //Promise.all(itemTable.map(item => Item.findOne({ _id: item.itemId }))),
     // Check if itemTable exists and is an array before mapping
     Array.isArray(itemTable) && itemTable.length > 0
     ? Promise.all(itemTable.map(item => Item.findOne({ _id: item.itemId })))
     : [],
    Settings.findOne({ organizationId }),
    Tax.findOne({ organizationId }), // Fetch tax details for the organization
  ]);

  return { organizationExists, supplierExists, purchaseOrderExists, items, settings , taxExists , existingPrefix };
};


exports.addBill = async (req, res) => {
  const { supplierId, itemTable, orderNumber, billDate } = req.body;
  const { organizationId } = req.user;
  console.log("reqbody:",req.body)


  try {
    // Fetch existing data including tax and settings
    const { organizationExists, supplierExists, items, settings, taxExists, existingPrefix } = await dataExistForBill(organizationId, supplierId, itemTable, orderNumber);

    // Normalize request body to handle null, empty strings, and 0 values
    const normalizedBody = normalizeRequestData(req.body);

    // Validate payment terms and calculate due date
    //const calculatedDueDateResponse = validateAndUpdateDueDate(normalizedBody.paymentTerms, normalizedBody.billDate, normalizedBody.existingDueDate);

    // Check for errors in calculatedDueDateResponse
    if (calculatedDueDateResponse.error) {
      return res.status(400).json({ message: calculatedDueDateResponse.error }); // Return the specific error message
    }

    const calculatedDueDate = calculatedDueDateResponse.dueDate; // Extract the valid due date

    // Perform additional validation checks
    if (await hasValidationErrors(normalizedBody, res)) return;

    if (!validateBillInputs(organizationExists, supplierExists, items, settings, taxExists, existingPrefix, res)) return;

    taxtype(normalizedBody, supplierExists);

    // Clean Data
    const cleanedData = cleanBillData(normalizedBody, supplierExists, items);
    cleanedData.dueDate = calculatedDueDate; // Set the calculated due date in the cleaned data

    // Check if paidAmount is valid
    if (!cleanedData.grandTotal || parseFloat(cleanedData.paidAmount) > parseFloat(cleanedData.grandTotal)) {
      return res.status(400).json({ message: "Paid amount cannot exceed the grand total." });
    }

    // Verify itemTable fields with Item schema and supply locations
    if (!validateItemTable(items, itemTable, cleanedData, supplierExists, res)) return;

    if (!validateLocationInputs(cleanedData, organizationExists, res)) return;

    // Check for existing bill
    if (await checkExistingBill(cleanedData.billNumber, organizationId, res)) return;

    // Date & Time
    const openingDate = generateOpeningDate(organizationExists);

    // Create new bill
    const savedBill = await createNewBill(cleanedData, organizationId, openingDate);

    // Track the items from the bill
    await trackItemsFromBill(organizationId, itemTable, billDate, savedBill);

    // Send success response
    res.status(201).json({ message: "Bill added successfully.", bill: savedBill });
  } catch (error) {
    console.error("Error adding bill:", error);
    res.status(500).json({ message: "Internal server error." }); // Return a generic server error message
  }
};


exports.getAllPurchaseBills = async (req, res) => {
  // const { organizationId } = req.body;
  const {organizationId} = req.user
  try {

    // Check if an Organization already exists
    const { organizationExists } = await dataExistForBill(organizationId);

    if (!organizationExists) {
      return res.status(404).json({
        message: "Organization not found",
      });
    }

    const purchaseBills = await PurchaseBill.find( {organizationId} );

    if (!purchaseBills || purchaseBills.length === 0) {
      return res.status(404).json({ message: "No purchase Bills found." });
    }

    // Get current date for comparison
    const currentDate = new Date();

    // Array to store purchase bills with updated status
    const updatedBills = [];

    // Map through purchase bills and update paidStatus if needed
    for (const bill of purchaseBills) {
      const { organizationId, balanceAmount, dueDate, paidStatus: currentStatus, ...rest } = bill.toObject();
      
      // Determine the correct paidStatus based on balanceAmount and dueDate
      let newStatus;
      if (balanceAmount === 0) {
        newStatus = 'Completed';
      } else if (dueDate && new Date(dueDate) < currentDate) {
        newStatus = 'Overdue';
      } else {
        newStatus = 'Pending';
      }

      // Update the bill's status only if it differs from the current status in the database
      if (newStatus !== currentStatus) {
        await PurchaseBill.updateOne({ _id: bill._id }, { paidStatus: newStatus });
      }

      // Push the bill object with the updated status to the result array
      updatedBills.push({ ...rest, balanceAmount , dueDate , paidStatus: newStatus });
    }

    res.status(200).json({ PurchaseBills: updatedBills });
  } catch (error) {
    console.error("Error fetching purchase Bills:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};



//getPurchaseOrder
exports.getPurchaseBill = async (req, res) => {
  try {
    const purchaseBillId = req.params.id;
    // const { organizationId } = req.body;
    const {organizationId} = req.user

    // Check if an Organization already exists
    const { organizationExists } = await dataExistForBill(organizationId);

    if (!organizationExists) {
      return res.status(404).json({
        message: "Organization not found",
      });
    }

    const purchaseBill = await PurchaseBill.findById({_id: purchaseBillId});
    purchaseBill.organizationId = undefined;
    if (purchaseBill) {
      res.status(200).json(purchaseBill);
    } else {
      res.status(404).json({ message: "Purchase Bill not found" });
    }
  } catch (error) {
    console.error("Error fetching a purchase Bill:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};



const normalizeRequestData = (data) => {
  const normalizedData = {};

  Object.keys(data).forEach((key) => {
    const value = data[key];

    // If value is null, empty string, or 0, set to undefined
    if (value === null || value === "" || value === 0 && key !== "taxMode") {
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


const validateItemTable = (items, itemTable, cleanedData, supplierExists, res) => {
  const { taxMode } = cleanedData;

  itemTable.forEach(item => {
    if (taxMode === 'Intra') {
      item.itemIgst = undefined;
      item.itemIgstAmount = undefined;
    } else {
      item.itemCgst = undefined;
      item.itemSgst = undefined;
      item.itemCgstAmount = undefined;
      item.itemSgstAmount = undefined;
    }
  });

  const fieldsToCheck = supplierExists.taxType === 'GST' ? [
    { tableField: 'itemSgst', itemField: 'sgst', error: 'SGST mismatch' },
    { tableField: 'itemCgst', itemField: 'cgst', error: 'CGST mismatch' },
    { tableField: 'itemIgst', itemField: 'igst', error: 'IGST mismatch' }
  ] : [{ tableField: 'itemVat', itemField: 'vat', error: 'VAT mismatch' }];

  for (let i = 0; i < itemTable.length; i++) {
    const tableItem = itemTable[i];
    const dbItem = items[i];
// console.log(tableItem.itemName)
    if (tableItem.itemName.trim() !== dbItem.itemName.trim()) {
      res.status(400).json({ message: `Item name mismatch for itemId: ${dbItem._id}` });
      return false;
    }

    if (parseFloat(tableItem.itemCostPrice) !== parseFloat(dbItem.costPrice)) {
      res.status(400).json({ message: `Cost price mismatch for itemId: ${dbItem._id}` });
      return false;
    }

    for (const { tableField, itemField, error } of fieldsToCheck) {
      if (tableItem[tableField] !== undefined && dbItem[itemField] !== undefined && parseFloat(tableItem[tableField]) !== parseFloat(dbItem[itemField])) {
        res.status(400).json({ message: `${error} for itemId: ${dbItem._id}` });
        return false;
      }
    }
  }

  return true; // Validation passed
};
// Amal


// Clean data
const cleanBillData = (data, supplierExists, items) => {    
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
      subTotal += itemQuantity * itemCostPrice;
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
      console.log("totaltax amount:",totalTaxAmount)

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
    cleanedData.subTotal = subTotal.toFixed(2);  // Overall subTotal
    cleanedData.totalItem = totalItem;  // Overall totalItem quantity
    cleanedData.totalTaxAmount = totalTaxAmount.toFixed(2);  // Total tax amount
    cleanedData.itemTotalDiscount = itemTotalDiscount.toFixed(2);  // Total discount
    console.log("TsubTotal:", cleanedData.subTotal);
    console.log("TtotalItem:", cleanedData.totalItem);
    console.log("TtotalTaxAmount:", cleanedData.totalTaxAmount);
    console.log("TitemTotalDiscount:", cleanedData.itemTotalDiscount);

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
      const transactionDiscountAmnt = (parseFloat(total) * parseFloat(transactionDiscount)) / 100;
      cleanedData.transactionDiscountAmount = transactionDiscountAmnt.toFixed(2);
    } else if (cleanedData.transactionDiscountType === "currency") {
      // If currency, apply the discount directly
      cleanedData.transactionDiscountAmount = parseFloat(transactionDiscount.toFixed(2));
    } 
    console.log("Grand Total before balance calculation:", cleanedData.grandTotal);
    console.log("Total:", total);

    // Calculate grandTotal
    cleanedData.grandTotal = (parseFloat(total) - parseFloat(cleanedData.transactionDiscountAmount)).toFixed(2);

    
    console.log("Backend - Grand Total:", cleanedData.grandTotal);
    console.log("Backend - Paid Amount:", cleanedData.paidAmount);
    // Calculate balanceAmount
    cleanedData.balanceAmount = (
      parseFloat(cleanedData.grandTotal) - 
      parseFloat(cleanedData.paidAmount || 0)
    ).toFixed(2);
    console.log("Backend - Calculated Balance Amount:", cleanedData.balanceAmount);

    // console.log("cleaned data:",cleanedData)
// updatePaidStatus(cleanedData);

  return cleanedData;
};



// // Set paidStatus based on dueDate and payment completion
// function updatePaidStatus(cleanedData) {
//   const isOverdue = moment().isAfter(moment(cleanedData.dueDate, 'YYYY-MM-DD'));
  
//   // Determine the paid status
//   if (isOverdue) {
//     cleanedData.paidStatus = "Overdue";
//   } else {
//     cleanedData.paidStatus = parseFloat(cleanedData.paidAmount) === parseFloat(cleanedData.grandTotal)
//       ? "Completed"
//       : "Pending";
//   }
// }


// function updatePaidStatus(cleanedData) {
//   const isOverdue = moment().isAfter(moment(cleanedData.dueDate, 'YYYY-MM-DD'));

//   // For other payment terms
//   if (isOverdue) {
//     cleanedData.paidStatus = "Overdue";
//   } 

//   //set paidStatus based on payment completion
//   if (cleanedData.paymentTerms === "Pay Now") {
//     // Check if the payment is fully completed
//     if (parseFloat(cleanedData.paidAmount) === parseFloat(cleanedData.grandTotal)) {
//       cleanedData.paymentMode = cleanedData.paymentMode || "Cash"; // Default to "Cash" if not specified
//       cleanedData.paidStatus = "Completed";
//     } else {
//       cleanedData.paidStatus = "Pending";
//       cleanedData.paymentMode = cleanedData.paymentMode || "Credit"; // Default to "Credit" if not specified
//       cleanedData.paidAmount = parseFloat(cleanedData.paidAmount || 0).toFixed(2);
//       cleanedData.balanceAmount = (
//         parseFloat(cleanedData.grandTotal) - parseFloat(cleanedData.paidAmount)
//       ).toFixed(2); // Recalculate balanceAmount
//     }
//   } 
// }


// Validation Error Check



const hasValidationErrors = async (body, supplierExists, res) => {
  const { itemTable, transactionDiscountType  } = body;
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


  // Check if paymentTerms is valid
  if (!validPaymentTerms.includes(paymentTerms)) {
    return { error: "Invalid payment terms." }; // Return error message for invalid payment terms
  }

  return false; // No validation errors
};

// const validateAndUpdateDueDate = (paymentTerms, billDate, existingDueDate) => {
//   const validPaymentTerms = [
//     "Net 15", "Net 30", "Net 45", "Net 60", "Pay Now", "due on receipt", "End of This Month", "End of Next Month"
//   ];

//   // Check if paymentTerms is valid
//   if (!validPaymentTerms.includes(paymentTerms)) {
//     return { error: "Invalid payment terms." }; // Return error message for invalid payment terms
//   }

//   // Calculate due date based on payment terms
//   let dueDate;

//   switch (paymentTerms) {
//     case "Net 15":
//       dueDate = moment(billDate).add(15, 'days').format('YYYY-MM-DD');
//       break;
//     case "Net 30":
//       dueDate = moment(billDate).add(30, 'days').format('YYYY-MM-DD');
//       break;
//     case "Net 45":
//       dueDate = moment(billDate).add(45, 'days').format('YYYY-MM-DD');
//       break;
//     case "Net 60":
//       dueDate = moment(billDate).add(60, 'days').format('YYYY-MM-DD');
//       break;
//     case "Pay Now":
//       dueDate = billDate; // Due date is the same as bill date
//       break;
//     case "due on receipt":
//       dueDate = existingDueDate; // Allow any date as existing due date
//       break;
//     case "End of This Month":
//       dueDate = moment(billDate).endOf('month').format('YYYY-MM-DD');
//       break;
//     case "End of Next Month":
//       dueDate = moment(billDate).add(1, 'month').endOf('month').format('YYYY-MM-DD');
//       break;
//     default:
//       return { error: "Invalid payment terms." }; // Handle invalid payment terms
//   }

//   // Ensure the due date is not earlier than the bill date
//   if (moment(dueDate).isBefore(billDate)) {
//     return { error: "Due date cannot be earlier than the bill date." }; // Return error message for invalid due date
//   }

//   return { dueDate }; // Return the calculated due date
// };



// Function to check for duplicate items by itemId in itemTable




function hasDuplicateItems(itemTable) {
  const itemIds = itemTable.map(item => item.itemId);
  const uniqueItemIds = new Set(itemIds);
  return itemIds.length !== uniqueItemIds.size;
}




const validateBillInputs = (organizationExists, supplierExists, items, taxExists,existingPrefix  ,res) => {


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
// Amal

// Validate supply locations
function validateLocationInputs(data, organizationExists, res) {
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
  const newBill = new PurchaseBill({ ...data, organizationId });
  return newBill.save();
}

// Track purchased items from the bill
const trackItemsFromBill = async (organizationId, itemTable, billDate, savedBill) => {
  for (const billItem of itemTable) {
    const { itemId, itemName, itemQuantity } = billItem;
    const savedItem = await Item.findOne({ _id: itemId, organizationId });

    if (savedItem) {
      const newStock = (savedItem.currentStock || 0) + Number(itemQuantity);
      // console.log(`Processing item: ${itemName}`);

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

      // console.log("Item Track Added for Bill:", trackEntry);
    } else {
      // console.error(`Item not found: ${itemId}`);
    }
  }
};

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
const validPaymentTerms = ["Net 15", "Net 30", "Net 45", "Net 60", "Pay Now", "due on receipt", "End of This Month", "End of Next Month"];
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