const DebitNote = require('../database/model/debitNote');
const Organization = require('../database/model/organization');
const Bills = require('../database/model/bills');
const Supplier = require('../database/model/supplier');
const Item = require('../database/model/item');
const Settings = require("../database/model/settings");
const ItemTrack = require("../database/model/itemTrack");
const Tax = require('../database/model/tax');  
const Prefix = require("../database/model/prefix");
const mongoose = require('mongoose');
const moment = require("moment-timezone");



// Fetch existing data
const dataExist = async ( organizationId, supplierId, billId ) => {
    const [organizationExists, supplierExist, billExist, settings, existingPrefix  ] = await Promise.all([
      Organization.findOne({ organizationId }, { organizationId: 1, organizationCountry: 1, state: 1 }),
      Supplier.findOne({ organizationId , _id:supplierId}, { _id: 1, supplierDisplayName: 1, taxType: 1 }),
      Bills.findOne({ organizationId, _id:billId }, { _id: 1, billNumber: 1, billDate: 1, orderNumber: 1, supplierId: 1, sourceOfSupply: 1, destinationOfSupply: 1, itemTable: 1 }),
      Settings.findOne({ organizationId }),
      Prefix.findOne({ organizationId })
    ]);    
  return { organizationExists, supplierExist, billExist, settings, existingPrefix };
};


//Fetch Item Data
const newDataExists = async (organizationId,items) => {
  // Retrieve items with specified fields
  const itemIds = items.map(item => item.itemId);

  const [newItems] = await Promise.all([
    Item.find({ organizationId, _id: { $in: itemIds } }, { _id: 1, itemName: 1, taxPreference: 1, costPrice:1,  taxRate: 1, cgst: 1, sgst: 1, igst: 1, vat: 1 }),
  ]);

  // Aggregate ItemTrack to get the latest entry for each itemId
  const itemTracks = await ItemTrack.aggregate([
    { $match: { itemId: { $in: itemIds } } },
    { $sort: { _id: -1 } },
    { $group: { _id: "$itemId", lastEntry: { $first: "$$ROOT" } } }
  ]);

  // Map itemTracks by itemId for easier lookup
  const itemTrackMap = itemTracks.reduce((acc, itemTrack) => {
    acc[itemTrack._id] = itemTrack.lastEntry;
    return acc;
  }, {});

  // Attach the last entry from ItemTrack to each item in newItems
  const itemTable = newItems.map(item => ({
    ...item._doc, // Copy item fields
    lastEntry: itemTrackMap[item._id] || null, // Attach lastEntry if found
    currentStock: itemTrackMap[item._id.toString()] ? itemTrackMap[item._id.toString()].currentStock : null
  }));

  return { itemTable };
};



const debitDataExist = async ( organizationId, debitId ) => {    
  const [organizationExists, allDebitNote, debitNote ] = await Promise.all([
    Organization.findOne({ organizationId }, { organizationId: 1}),
    DebitNote.find({ organizationId }),
    DebitNote.findOne({ organizationId , _id: debitId })
  ]);
  return { organizationExists, allDebitNote, debitNote };
};




// Add debit note
exports.addDebitNote = async (req, res) => {
  // console.log("Add debit note:", req.body);

  try {
    const { organizationId, id: userId, userName } = req.user;
    // const { organizationId } = req.body;

    //Clean Data
    const cleanedData = cleanDebitNoteData(req.body);

    const { items } = cleanedData;
    const { supplierId } = cleanedData;
    const { billId } = cleanedData;
    
    const itemIds = items.map(item => item.itemId);
    
    // Check for duplicate itemIds
    const uniqueItemIds = new Set(itemIds);
    if (uniqueItemIds.size !== itemIds.length) {
      return res.status(400).json({ message: "Duplicate Item found" });
    }

    //Validate Supplier
    if (!mongoose.Types.ObjectId.isValid(supplierId) || supplierId.length !== 24) {
      return res.status(400).json({ message: `Invalid supplier ID: ${supplierId}` });
    }

    //Validate bill
    if (!mongoose.Types.ObjectId.isValid(billId) || billId.length !== 24) {
      return res.status(400).json({ message: `Invalid bill ID: ${billId}` });
    }

    // Validate ItemIds
    const invalidItemIds = itemIds.filter(itemId => !mongoose.Types.ObjectId.isValid(itemId) || itemId.length !== 24);
    if (invalidItemIds.length > 0) {
      return res.status(400).json({ message: `Invalid item IDs: ${invalidItemIds.join(', ')}` });
    }   

    const { organizationExists, supplierExist, billExist, settings, existingPrefix } = await dataExist( organizationId, supplierId, billId );

    const { itemTable } = await newDataExists( organizationId, items );

    //Data Exist Validation
    if (!validateOrganizationTaxCurrency( organizationExists, supplierExist, billExist, existingPrefix, res )) return;

    //Validate Inputs  
    if (!validateInputs( cleanedData, supplierExist, billExist, items, itemTable, organizationExists, res)) return;

    //Date & Time
    const openingDate = generateOpeningDate(organizationExists);

    //Tax Type
    taxtype(cleanedData, supplierExist );
    
    
    // Calculate Sales 
    if (!calculateDebitNote( cleanedData, itemTable, res )) return;

    // // console.log('Calculation Result:', result);

    //Prefix
    await debitNotePrefix(cleanedData, existingPrefix );

    const savedDebitNote = await createNewDebitNote(cleanedData, organizationId, openingDate, userId, userName );

    //Item Track
    await itemTrack( savedDebitNote, itemTable );
      
    res.status(201).json({ message: "Debit Note created successfully",savedDebitNote });
    // console.log( "Debit Note created successfully:", savedDebitNote );
  } catch (error) {
    console.error("Error Creating Debit Note:", error);
    res.status(500).json({ message: "Internal server error." });
  }
}



// Get All Debit Note
exports.getAllDebitNote = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const { organizationExists, allDebitNote } = await debitDataExist(organizationId);

    if (!organizationExists) {
      return res.status(404).json({
        message: "Organization not found",
      });
    }

    if (!allDebitNote.length) {
      return res.status(404).json({
        message: "No Debit Note found",
      });
    }

    res.status(200).json(allDebitNote);
  } catch (error) {
    console.error("Error fetching Debit Note:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};


// Get One Debit Note
exports.getOneDebitNote = async (req, res) => {
try {
  const organizationId = req.user.organizationId;
  const debitId = req.params.debitId;

  const { organizationExists, debitNote } = await debitDataExist(organizationId, debitId);

  if (!organizationExists) {
    return res.status(404).json({
      message: "Organization not found",
    });
  }

  if (!debitNote) {
    return res.status(404).json({
      message: "No Debit Note found",
    });
  }

  // Fetch item details associated with the debitNote
  const itemIds = debitNote.items.map(item => item.itemId);

  // Retrieve items including itemImage
  const itemsWithImages = await Item.find(
    { _id: { $in: itemIds }, organizationId },
    { _id: 1, itemName: 1, itemImage: 1 } 
  );

  // Map the items to include item details
  const updatedItems = debitNote.items.map(debitNoteItem => {
    const itemDetails = itemsWithImages.find(item => item._id.toString() === debitNoteItem.itemId.toString());
    return {
      ...debitNoteItem.toObject(),
      itemName: itemDetails ? itemDetails.itemName : null,
      itemImage: itemDetails ? itemDetails.itemImage : null,
    };
  });

  // Attach updated items back to the debitNote
  const updatedDebitNote = {
    ...debitNote.toObject(),
    items: updatedItems,
  };

  res.status(200).json(updatedDebitNote);
} catch (error) {
  console.error("Error fetching Debit Note:", error);
  res.status(500).json({ message: "Internal server error." });
}
};


// Get last debit note prefix
exports.getLastDebitNotePrefix = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

      // Find all accounts where organizationId matches
      const prefix = await Prefix.findOne({ organizationId:organizationId,'series.status': true });

      if (!prefix) {
          return res.status(404).json({
              message: "No Prefix found for the provided organization ID.",
          });
      }
      
      const series = prefix.series[0];     
      const lastPrefix = series.debitNote + series.debitNoteNum;

      res.status(200).json(lastPrefix);
  } catch (error) {
      console.error("Error fetching accounts:", error);
      res.status(500).json({ message: "Internal server error." });
  }
};

// Debit Note Prefix
function debitNotePrefix( cleanData, existingPrefix ) {
  const activeSeries = existingPrefix.series.find(series => series.status === true);
  if (!activeSeries) {
      return res.status(404).json({ message: "No active series found for the organization." });
  }
  cleanData.debitNote = `${activeSeries.debitNote}${activeSeries.debitNoteNum}`;

  activeSeries.debitNoteNum += 1;

  existingPrefix.save()

  return 
}










// Create New Debit Note
function createNewDebitNote( data, organizationId, openingDate, userId, userName ) {
  const newDebitNote = new DebitNote({ ...data, organizationId, createdDate: openingDate, userId, userName });
  return newDebitNote.save();
}



//Clean Data 
function cleanDebitNoteData(data) {
  const cleanData = (value) => (value === null || value === undefined || value === "" ? undefined : value);
  return Object.keys(data).reduce((acc, key) => {
    acc[key] = cleanData(data[key]);
    return acc;
  }, {});
}


// Validate Organization Tax Currency
function validateOrganizationTaxCurrency( organizationExists, supplierExist, billExist, existingPrefix, res ) {
  if (!organizationExists) {
    res.status(404).json({ message: "Organization not found" });
    return false;
  }
  if (!supplierExist) {
    res.status(404).json({ message: "Supplier not found." });
    return false;
  }
  if (!billExist) {
    res.status(404).json({ message: "Bill not found" });
    return false;
  }
  if (!existingPrefix) {
    res.status(404).json({ message: "Prefix not found" });
    return false;
  }
  return true;
}




// Tax Type
function taxtype( cleanedData, supplierExist ) {

  if(supplierExist.taxType === 'GST' ){
    if(cleanedData.sourceOfSupply === cleanedData.destinationOfSupply){
      cleanedData.taxMode ='Intra';
    }
    else{
      cleanedData.taxMode ='Inter';
    }
  }
  if(supplierExist.taxType === 'VAT' ){
    cleanedData.taxMode ='VAT'; 
  }
  return   
}




function calculateDebitNote(cleanedData, itemTable, res) {
  const errors = [];

  let subTotal = 0;
  let totalTaxAmount = 0;
  // let itemTotalDiscount= 0;
  let totalItem = 0;
  // let transactionDiscountAmount = 0;
  let grandTotal = 0;

  // Utility function to round values to two decimal places
  const roundToTwoDecimals = (value) => Number(value.toFixed(2));  

  cleanedData.items.forEach(item => {

    let calculatedItemCgstAmount = 0;
    let calculatedItemSgstAmount = 0;
    let calculatedItemIgstAmount = 0;
    let calculatedItemVatAmount = 0;
    let calculatedItemTaxAmount = 0;
    let itemAmount = 0;
    let taxMode = cleanedData.taxMode;

    // Calculate item line discount 
    // const itemDiscAmt = calculateItemDiscount(item);

    // itemTotalDiscount +=  parseFloat(itemDiscAmt);
    totalItem +=  parseInt(item.itemQuantity);
    subTotal += parseFloat(item.itemQuantity * item.itemCostPrice);

    // itemAmount = (item.itemCostPrice * item.itemQuantity - itemDiscAmt);
    itemAmount = (item.itemCostPrice * item.itemQuantity);

    // Handle tax calculation only for taxable items
    if (item.taxPreference === 'Taxable') {
      switch (taxMode) {
        
        case 'Intra':
          calculatedItemCgstAmount = roundToTwoDecimals((item.itemCgst / 100) * itemAmount);
          calculatedItemSgstAmount = roundToTwoDecimals((item.itemSgst / 100) * itemAmount);
        break;

        case 'Inter':
          calculatedItemIgstAmount = roundToTwoDecimals((item.itemIgst / 100) * itemAmount);
        break;
        
        case 'VAT':
          calculatedItemVatAmount = roundToTwoDecimals((item.itemVat / 100) * itemAmount);
        break;

      }

      calculatedItemTaxAmount =  calculatedItemCgstAmount + calculatedItemSgstAmount + calculatedItemIgstAmount + calculatedItemVatAmount;
      
      // Check tax amounts
      checkAmount(calculatedItemCgstAmount, item.itemCgstAmount, item.itemName, 'CGST',errors);
      checkAmount(calculatedItemSgstAmount, item.itemSgstAmount, item.itemName, 'SGST',errors);
      checkAmount(calculatedItemIgstAmount, item.itemIgstAmount, item.itemName, 'IGST',errors);
      checkAmount(calculatedItemVatAmount, item.itemVatAmount, item.itemName, 'VAT',errors);
      checkAmount(calculatedItemTaxAmount, item.itemTax, item.itemName, 'Item tax',errors);

      totalTaxAmount += calculatedItemTaxAmount;     

    } else {
      console.log(`Skipping Tax for Non-Taxable item: ${item.itemName}`);
      // console.log(`Item: ${item.itemName}, Calculated Discount: ${itemDiscAmt}`);
    }

    checkAmount(itemAmount, item.itemAmount, item.itemName, 'Item Total',errors);

    console.log(`${item.itemName} Item Total: ${itemAmount} , Provided ${item.itemAmount}`);
    console.log(`${item.itemName} Total Tax: ${calculatedItemTaxAmount} , Provided ${item.itemTax || 0 }`);
    console.log("");
  });

  // const total = ((parseFloat(subTotal) + parseFloat(totalTaxAmount)) - itemTotalDiscount);
  const total = ((parseFloat(subTotal) + parseFloat(totalTaxAmount)));

  console.log(`SubTotal: ${subTotal} , Provided ${cleanedData.subTotal}`);

  // Transaction Discount
  // let transDisAmt = calculateTransactionDiscount(cleanedData, total, transactionDiscountAmount); 

  // grandTotal amount calculation with including transactionDiscount
  // grandTotal = total - transDisAmt; 
  grandTotal = total; 

  // Round the totals for comparison
  const roundedSubTotal = roundToTwoDecimals(subTotal); //23.24 
  const roundedTotalTaxAmount = roundToTwoDecimals(totalTaxAmount);
  const roundedGrandTotalAmount = roundToTwoDecimals(grandTotal);
  // const roundedTotalItemDiscount = roundToTwoDecimals(itemTotalDiscount);

  console.log(`Final Sub Total: ${roundedSubTotal} , Provided ${cleanedData.subTotal}` );
  console.log(`Final Total Tax Amount: ${roundedTotalTaxAmount} , Provided ${cleanedData.totalTaxAmount}` );
  console.log(`Final Total Amount: ${roundedGrandTotalAmount} , Provided ${cleanedData.grandTotal}` );
  // console.log(`Final Total Item Discount Amount: ${roundedTotalItemDiscount} , Provided ${cleanedData.itemTotalDiscount}` );

  validateAmount(roundedSubTotal, cleanedData.subTotal, 'SubTotal', errors);
  validateAmount(roundedTotalTaxAmount, cleanedData.totalTaxAmount, 'Total Tax Amount', errors);
  validateAmount(roundedGrandTotalAmount, cleanedData.grandTotal, 'Grand Total', errors);
  // validateAmount(roundedTotalItemDiscount, cleanedData.itemTotalDiscount, 'Total Item Discount Amount', errors);
  validateAmount(totalItem, cleanedData.totalItem, 'Total Item count', errors);

  if (errors.length > 0) {
    res.status(400).json({ message: errors.join(", ") });
    return false;
  }

  return true;
}


// // Calculate item discount
// function calculateItemDiscount(item) {
//   return item.itemDiscountType === 'currency'
//     ? item.itemDiscount || 0
//     : (item.itemCostPrice * item.itemQuantity * (item.itemDiscount || 0)) / 100;    //if percentage
// }


// //TransactionDiscount
// function calculateTransactionDiscount(cleanedData, total, transactionDiscountAmount) {
//   transactionDiscountAmount = cleanedData.transactionDiscount || 0;

//   return cleanedData.transactionDiscountType === 'currency'
//     ? transactionDiscountAmount
//     : (total * cleanedData.transactionDiscount) / 100;    //if percentage
// }


//Mismatch Check
function checkAmount(calculatedAmount, providedAmount, itemName, taxMode, errors) {
  const roundToTwoDecimals = (value) => Number(value.toFixed(2)); // Round to two decimal places
  const roundedAmount = roundToTwoDecimals(calculatedAmount);
  console.log(`Item: ${itemName}, Calculated ${taxMode}: ${roundedAmount}, Provided data: ${providedAmount}`);

  if (Math.abs(roundedAmount - providedAmount) > 0.01) {
    const errorMessage = `Mismatch in ${taxMode} for item ${itemName}: Calculated ${calculatedAmount}, Provided ${providedAmount}`;
    errors.push(errorMessage);
    console.log(errorMessage);
  }
}


//Final Item Amount check
const validateAmount = ( calculatedValue, cleanedValue, label, errors ) => {
  const isCorrect = calculatedValue === parseFloat(cleanedValue);
  if (!isCorrect) {
    const errorMessage = `${label} is incorrect: ${cleanedValue}`;
    errors.push(errorMessage);
    console.log(errorMessage);
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









//Validate inputs
function validateInputs( data, supplierExist, billExist, items, itemExists, organizationExists, res) {
  const validationErrors = validateDebitNoteData(data, supplierExist, billExist, items, itemExists, organizationExists);  

  if (validationErrors.length > 0) {
    res.status(400).json({ message: validationErrors.join(", ") });
    return false;
  }
  return true;
}

//Validate Data
function validateDebitNoteData( data, supplierExist, billExist, items, itemTable, organizationExists ) {
  const errors = [];

  // console.log("Item Request :",items);
  // console.log("Item Fetched :",itemTable);

  //Basic Info
  validateReqFields( data, supplierExist, errors );
  validateItemTable(items, itemTable, errors);
  validateBillData(data, items, billExist, errors);
  // validateTransactionDiscountType(data.transactionDiscountType, errors);
  // console.log("billExist Data:", billExist.billNumber, billExist.billDate, billExist.orderNumber)

  //OtherDetails
  validateIntegerFields(['totalItem'], data, errors);
  // validateFloatFields(['transactionDiscountAmount', 'subTotal','cgst','sgst','igst','vat','totalTaxAmount','grandTotal'], data, errors);
  validateFloatFields(['subTotal','cgst','sgst','igst','vat','totalTaxAmount','grandTotal'], data, errors);
  //validateAlphabetsFields(['department', 'designation'], data, errors);

  //Tax Details
  //validateTaxType(data.taxType, validTaxTypes, errors);
  validateSourceOfSupply(data.sourceOfSupply, organizationExists, errors);
  validateDestinationOfSupply(data.destinationOfSupply, organizationExists, errors);
  validateBillType(data.billType, errors);
  validatePaymentMode(data.paymentMode, errors);
  //validateGSTorVAT(data, errors);

  //Currency
  //validateCurrency(data.currency, validCurrencies, errors);

  //Address
  //validateBillingAddress(data, errors);
  //validateShippingAddress(data, errors);  
  return errors;
}



// Field validation utility
function validateField(condition, errorMsg, errors) {
  if (condition) errors.push(errorMsg);
}


//Valid Req Fields
function validateReqFields( data, supplierExist, errors ) {
validateField( typeof data.supplierId === 'undefined' || typeof data.supplierDisplayName === 'undefined', "Please select a Supplier", errors  );
validateField( supplierExist.taxtype == 'GST' && typeof data.sourceOfSupply === 'undefined', "Source of supply required", errors  );
validateField( supplierExist.taxtype == 'GST' && typeof data.destinationOfSupply === 'undefined', "Destination of supply required", errors  );
validateField( typeof data.items === 'undefined', "Select an item", errors  );
validateField( typeof data.billNumber === 'undefined', "Select an bill number", errors  );
validateField( typeof data.billType === 'undefined', "Select an bill type", errors  );
}


// Function to Validate Item Table 
function validateItemTable(items, itemTable, errors) {
// Check for item count mismatch
validateField( items.length !== itemTable.length, "Mismatch in item count between request and database.", errors  );

// Iterate through each item to validate individual fields
items.forEach((item) => {
  const fetchedItem = itemTable.find(it => it._id.toString() === item.itemId);

  // Check if item exists in the item table
  validateField( !fetchedItem, `Item with ID ${item.itemId} was not found.`, errors );
  if (!fetchedItem) return; 

  // Validate item name
  validateField( item.itemName !== fetchedItem.itemName, `Item Name Mismatch : ${item.itemName}`, errors );

  // Validate cost price
  // validateField( item.itemCostPrice !== fetchedItem.costPrice, `Cost price Mismatch for ${item.itemName}:  ${item.itemCostPrice}`, errors );

  // Validate CGST
  validateField( item.itemCgst !== fetchedItem.cgst, `CGST Mismatch for ${item.itemName}: ${item.itemCgst}`, errors );

  // Validate SGST
  validateField( item.itemSgst !== fetchedItem.sgst, `SGST Mismatch for ${item.itemName}: ${item.itemSgst}`, errors );

  // Validate IGST
  validateField( item.itemIgst !== fetchedItem.igst, `IGST Mismatch for ${item.itemName}: ${item.itemIgst}`, errors );

  // Validate tax preference
  validateField( item.taxPreference !== fetchedItem.taxPreference, `Tax Preference mismatch for ${item.itemName}: ${item.taxPreference}`, errors );

  // Validate discount type
  // validateItemDiscountType(item.itemDiscountType, errors);

  // Validate integer fields
  validateIntegerFields(['itemQuantity'], item, errors);

  // Validate Stock Count 
  validateField( item.itemQuantity > fetchedItem.currentStock, `Insufficient Stock for ${item.itemName}: Requested quantity ${item.itemQuantity}, Available stock ${fetchedItem.currentStock}`, errors );

  // Validate float fields
  validateFloatFields(['itemCostPrice', 'itemTotaltax', 'itemAmount'], item, errors);
});
}


// valiadate bill data
function validateBillData(data, items, billExist, errors) {  
  // console.log("data:", data);
  // console.log("billExist:", billExist);
  // console.log("items:", items);

   // Initialize `billExist.items` to an empty array if undefined
   billExist.items = Array.isArray(billExist.itemTable) ? billExist.itemTable : [];

  // Validate basic fields
  validateField( billExist.billDate !== data.billDate, `Bill Date mismatch for ${billExist.billDate}`, errors  );
  validateField( billExist.orderNumber !== data.orderNumber, `Order Number mismatch for ${billExist.orderNumber}`, errors  );

  // Loop through each item in billExist.items
  billExist.items.forEach(billItem => {
    const dNItem = items.find(dataItem => dataItem.itemId === billItem.itemId);

    if (!dNItem) {
      errors.push(`Item ID ${billItem.itemId} not found in provided items`);
    } else {
      
     // Convert quantities to numbers for comparison
     const dNItemQuantity = Number(dNItem.itemQuantity);
     const billItemQuantity = Number(billItem.itemQuantity);

     // Check if the debit note item quantity exceeds the allowed quantity in the bill
     if (dNItemQuantity > billItemQuantity) {
       errors.push(
         `Item Quantity for ${billItem.itemId} exceeds allowed quantity: Maximum ${billItemQuantity}, got ${dNItemQuantity}`
       );
     }
      
      validateField(dNItem.itemName !== billItem.itemName, 
                    `Item Name mismatch for ${billItem.itemId}: Expected ${billItem.itemName}, got ${dNItem.itemName}`, 
                    errors);
      validateField(dNItem.itemCostPrice !== billItem.itemCostPrice, 
                    `Item Cost Price mismatch for ${billItem.itemId}: Expected ${billItem.itemCostPrice}, got ${dNItem.itemCostPrice}`, 
                    errors);
      validateField(dNItem.itemCgst !== billItem.itemCgst, 
                    `Item CGST mismatch for ${billItem.itemId}: Expected ${billItem.itemCgst}, got ${dNItem.itemCgst}`, 
                    errors);
      validateField(dNItem.itemSgst !== billItem.itemSgst, 
                    `Item SGST mismatch for ${billItem.itemId}: Expected ${billItem.itemSgst}, got ${dNItem.itemSgst}`, 
                    errors);
      validateField(dNItem.itemIgst !== billItem.itemIgst, 
                    `Item IGST mismatch for ${billItem.itemId}: Expected ${billItem.itemIgst}, got ${dNItem.itemIgst}`, 
                    errors);
      // validateField(dNItem.itemDiscount !== billItem.itemDiscount, 
      //               `Item Discount mismatch for ${billItem.itemId}: Expected ${billItem.itemDiscount}, got ${dNItem.itemDiscount}`, 
      //               errors);
    }
  });
}



// Validate source Of Supply
function validateSourceOfSupply(sourceOfSupply, organization, errors) {
  validateField(
    sourceOfSupply && !validCountries[organization.organizationCountry]?.includes(sourceOfSupply),
    "Invalid Source of Supply: " + sourceOfSupply, errors );
}

// Validate destination Of Supply
function validateDestinationOfSupply(destinationOfSupply, organization, errors) {
  validateField(
    destinationOfSupply && !validCountries[organization.organizationCountry]?.includes(destinationOfSupply),
    "Invalid Destination of Supply: " + destinationOfSupply, errors );
}

// //Validate Discount Transaction Type
// function validateTransactionDiscountType(transactionDiscountType, errors) {
// validateField(transactionDiscountType && !validTransactionDiscountType.includes(transactionDiscountType),
//   "Invalid Transaction Discount: " + transactionDiscountType, errors);
// } 

// //Validate Item Discount Transaction Type
// function validateItemDiscountType(itemDiscountType, errors) {
//   validateField(itemDiscountType && !validItemDiscountType.includes(itemDiscountType),
//     "Invalid Item Discount: " + itemDiscountType, errors);
// }

// Validate Bill Type
function validateBillType(billType, errors) {
  validateField(
    billType && !validBillType.includes(billType),
    "Invalid Bill Type: " + billType, errors );
}


// Validate Payment Mode
function validatePaymentMode(paymentMode, errors) {
  validateField(
    paymentMode && !validPaymentMode.includes(paymentMode),
    "Invalid Payment Mode: " + paymentMode, errors );
}




//Valid Alphanumeric Fields
function validateAlphanumericFields(fields, data, errors) {
  fields.forEach((field) => {
    validateField(data[field] && !isAlphanumeric(data[field]), "Invalid " + field + ": " + data[field], errors);
  });
}
// Validate Integer Fields
function validateIntegerFields(fields, data, errors) {
fields.forEach(field => {
  validateField(data[field] && !isInteger(data[field]), `Invalid ${field}: ${data[field]}`, errors);
});
}
//Valid Float Fields  
function validateFloatFields(fields, data, errors) {
  fields.forEach((balance) => {
    validateField(data[balance] && !isFloat(data[balance]),
      "Invalid " + balance.replace(/([A-Z])/g, " $1") + ": " + data[balance], errors);
  });
}
//Valid Alphabets Fields 
function validateAlphabetsFields(fields, data, errors) {
  fields.forEach((field) => {
    if (data[field] !== undefined) {
      validateField(!isAlphabets(data[field]),
        field.charAt(0).toUpperCase() + field.slice(1) + " should contain only alphabets.", errors);
    }
  });
}




// Helper functions to handle formatting
function capitalize(word) {
return word.charAt(0).toUpperCase() + word.slice(1);
}

function formatCamelCase(word) {
return word.replace(/([A-Z])/g, " $1");
}

// Validation helpers
function isAlphabets(value) {
return /^[A-Za-z\s]+$/.test(value);
}

function isFloat(value) {
return /^-?\d+(\.\d+)?$/.test(value);
}

function isInteger(value) {
return /^\d+$/.test(value);
}

function isAlphanumeric(value) {
return /^[A-Za-z0-9]+$/.test(value);
}

function isValidEmail(value) {
return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}




// Item Track Function
async function itemTrack(savedDebitNote, itemTable) {
  const { items } = savedDebitNote;

  for (const item of items) {
    // Find the matching item in itemTable by itemId
    const matchingItem = itemTable.find((entry) => entry._id.toString() === item.itemId);

    if (!matchingItem) {
      console.error(`Item with ID ${item.itemId} not found in itemTable`);
      continue; // Skip this entry if not found
    }

    // Calculate the new stock level after the sale
    const newStock = matchingItem.currentStock - item.itemQuantity;
    if (newStock < 0) {
      console.error(`Insufficient stock for item ${item.itemName}`);
      continue; // Skip this entry if stock is insufficient
    }

    // Create a new entry for item tracking
    const newTrialEntry = new ItemTrack({
      organizationId: savedDebitNote.organizationId,
      operationId: savedDebitNote._id,
      transactionId: savedDebitNote.debitNote,
      action: "Debit Note",
      date: savedDebitNote.supplierDebitDate,
      itemId: matchingItem._id,
      itemName: matchingItem.itemName,
      sellingPrice: matchingItem.itemSellingPrice,
      costPrice: matchingItem.itemCostPrice || 0, // Assuming cost price is in itemTable
      creditQuantity: item.itemQuantity, // Quantity sold
      currentStock: newStock,
      remark: `Sold to ${savedDebitNote.supplierDisplayName}`,
    });

    // Save the tracking entry and update the item's stock in the item table
    await newTrialEntry.save();

    console.log("1",newTrialEntry);
  }
}





// Utility functions
// const validItemDiscountType = ["percentage", "currency"];
// const validTransactionDiscountType = ["percentage", "currency"];
const validPaymentMode = [ "Cash", "Credit" ]
const validBillType = [
  "Registered", 
  "Deemed Export", 
  "SEZ With Payment", 
  "SEZ Without Payment", 
  "SEZ Without Payment", 
  "Export With Payment", 
  "Export Without Payment", 
  "B2C (Large)", "B2C Others"
];
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

