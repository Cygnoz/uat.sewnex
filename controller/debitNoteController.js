const DebitNote = require('../database/model/debitNote');
const Organization = require('../database/model/organization');
const Bills = require('../database/model/bills');
const Supplier = require('../database/model/supplier');
const Item = require('../database/model/item');
const Settings = require("../database/model/settings");
const ItemTrack = require("../database/model/itemTrack");
const Tax = require('../database/model/tax');  
const Prefix = require("../database/model/prefix");



// Fetch existing data
const dataExist = async ( organizationId, items, supplierId, billId ) => {
  const itemIds = items.map(item => item.itemId);
    const [organizationExists, supplierExist, billExist, settings, itemTable, existingPrefix  ] = await Promise.all([
      Organization.findOne({ organizationId }, { organizationId: 1, organizationCountry: 1, state: 1 }),
      Supplier.findOne({ organizationId , _id:supplierId, supplierDisplayName}, { _id: 1, supplierDisplayName: 1, taxType: 1 }),
      Bills.findOne({ organizationId, _id:billId, billNumber, billDate, orderNumber }, { _id: 1, billNumber: 1, billDate: 1, orderNumber: 1 }),
      Settings.findOne({ organizationId }),
      Item.find({ organizationId, _id: { $in: itemIds } }, { _id: 1, itemName: 1, taxPreference: 1, costPrice: 1, taxRate: 1, cgst: 1, sgst: 1, igst: 1, vat: 1 }),
      Prefix.findOne({ organizationId })
    ]);
  return { organizationExists, supplierExist, billExist, settings, itemTable, existingPrefix };
};


// Add debit note
exports.addDebitNote = async (req, res) => {
  //console.log("Add debit note:", req.body);

  try {
    // const { organizationId, id: userId, userName } = req.user;
    const { organizationId } = req.body;

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

    const { organizationExists, supplierExist, billExist, settings, itemTable, existingPrefix } = await dataExist( organizationId, items, supplierId, billId );

    //Data Exist Validation
    if (!validateOrganizationTaxCurrency( organizationExists, supplierExist, billExist, existingPrefix, res )) return;
    
    //Date & Time
    const openingDate = generateOpeningDate(organizationExists);

    //Validate Inputs  
    if (!validateInputs( cleanedData, supplierExist, billExist, items, itemTable, organizationExists, res)) return;

    //Tax Type
    taxtype(cleanedData, supplierExist );
    
    
    // Calculate Sales 
    if (!calculateDebitNote( cleanedData, res )) return;

    // // console.log('Calculation Result:', result);

    //Prefix
    await debitNotePrefix(cleanedData, existingPrefix );

    const savedDebitNote = await createNewDebitNote(cleanedData, organizationId, openingDate
      // , userId, userName 
    );
      
    res.status(201).json({ message: "Debit Note created successfully" });
    console.log( "Debit Note created successfully:", savedDebitNote );
  } catch (error) {
    console.error("Error Creating Debit Note:", error);
    res.status(500).json({ message: "Internal server error." });
  }
}



// Create New Debit Note
function createNewDebitNote( data, organizationId, openingDate
  // , userId, userName 
) {
  const newQuotes = new DebitNote({ ...data, organizationId, createdDate: openingDate
    // , userId, userName 
  });
  return newQuotes.save();
}



//Clean Data 
function cleanDebitNoteData(data) {
  const cleanData = (value) => (value === null || value === undefined || value === "" || value === 0 ? undefined : value);
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
    res.status(404).json({ message: "Supplier not found" });
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
  if(supplierExist.taxType === 'Non-Tax' ){
    cleanedData.taxMode ='Non-Tax';
  } 
  return   
}





// function calculateDebitNote(cleanedData, res) {
//   const errors = [];

//   let grandTotal = 0;
//   let subTotal = 0;
//   let totalTaxAmount = 0;
//   let itemTotalDiscount= 0;
//   let totalItemCount = 0;
//   // let transactionDiscountAmount = 0;
//   // Calculate the grandTotal without including transactionDiscount
//   const total = (
//     (parseFloat(cleanedData.subTotal) +
//     parseFloat(cleanedData.totalTaxAmount) +
//     cleanedData.otherExpense +      
//     cleanedData.freight -           
//     cleanedData.roundOff) - cleanedData.itemTotalDiscount      
//   ).toFixed(2);


//   cleanedData.items.forEach(item => {

//     let calculatedCgstAmount = 0;
//     let calculatedSgstAmount = 0;
//     let calculatedIgstAmount = 0;
//     let calculatedVatAmount = 0;
//     let calculatedTaxAmount = 0;
//     let taxMode = cleanedData.taxMode;

//     // Calculate item line discount 
//     const itemDiscountAmount = calculateItemDiscount(item);

//     itemTotalDiscount +=  parseFloat(itemDiscountAmount);
//     totalItemCount +=  parseFloat(item.itemQuantity);

//     let itemTotal = (item.itemCostPrice * item.itemQuantity) - itemDiscountAmount;
    

//     // Handle tax calculation only for taxable items
//     if (item.taxPreference === 'Taxable') {
//       switch (taxMode) {
        
//         case 'Intra':
//         calculatedCgstAmount = (item.itemCgst / 100) * itemTotal;
//         calculatedSgstAmount = (item.itemSgst / 100) * itemTotal;
//         itemTotal += calculatedCgstAmount + calculatedSgstAmount;
//         break;

//         case 'Inter':
//         calculatedIgstAmount = (item.itemIgst / 100) * itemTotal;
//         itemTotal += calculatedIgstAmount;
//         break;
        
//         case 'VAT':
//         calculatedVatAmount = (item.itemVat / 100) * itemTotal;
//         itemTotal += calculatedVatAmount;
//         break;

//       }
//       calculatedTaxAmount =  calculatedCgstAmount + calculatedSgstAmount + calculatedIgstAmount + calculatedVatAmount;
      
//       // Log calculated tax amounts

//       logCalculatedTax(item, calculatedCgstAmount, calculatedSgstAmount,  calculatedIgstAmount, calculatedVatAmount );

//       // Check tax amounts
//       checkAmount(calculatedCgstAmount, item.itemCgstAmount, item.itemName, 'CGST',errors);
//       checkAmount(calculatedSgstAmount, item.itemSgstAmount, item.itemName, 'SGST',errors);
//       checkAmount(calculatedIgstAmount, item.itemIgstAmount, item.itemName, 'IGST',errors);
//       checkAmount(calculatedVatAmount, item.itemVatAmount, item.itemName, 'VAT',errors);
//       checkAmount(calculatedTaxAmount, item.itemTotaltax, item.itemName, 'Total tax',errors);

//       totalTaxAmount += calculatedCgstAmount + calculatedSgstAmount + calculatedIgstAmount + calculatedVatAmount || 0 ;


//     } else {
//       console.log(`Skipping Tax for Non-Taxable item: ${item.itemName}`);
//       console.log(`Item: ${item.itemName}, Calculated Discount: ${itemTotalDiscount}`);

//     }

//     // Update total values
//     subTotal += parseFloat(itemQuantity * itemCostPrice);

//     checkAmount(itemTotal, item.itemAmount, item.itemName, 'Item Total',errors);

//     console.log(`${item.itemName} Item Total: ${itemTotal} , Provided ${item.itemAmount}`);
//     console.log(`${item.itemName} Total Tax: ${calculatedTaxAmount} , Provided ${item.itemTotaltax || 0 }`);
//     console.log("");
//   });

//   console.log(`SubTotal: ${subTotal} , Provided ${cleanedData.subTotal}`);

//   // Transaction Discount
//   let transactionDiscount = calculateTransactionDiscount(cleanedData, total); 

//   // grandTotal amount calculation with including transactionDiscount
//   grandTotal = total - transactionDiscount; 

//   const roundToTwoDecimals = (value) => Math.round(value * 100) / 100;

//   // Validate calculated totals against cleanedData data
//   const calculatedSubTotal = subTotal;
//   const calculatedTotalTaxAmount = totalTaxAmount;
//   const calculatedGrandTotalAmount = grandTotal;
//   // const calculatedTransactionDiscountAmount = transactionDiscountAmount;

//   // Round the totals for comparison
//   const roundedSubTotal = roundToTwoDecimals(calculatedSubTotal);
//   const roundedTotalTaxAmount = roundToTwoDecimals(calculatedTotalTaxAmount);
//   const roundedGrandTotalAmount = roundToTwoDecimals(calculatedGrandTotalAmount);
//   // const roundedTransactionDiscountAmount = roundToTwoDecimals(calculatedTransactionDiscountAmount);

//   console.log(`Final Sub Total: ${roundedSubTotal} , Provided ${cleanedData.subTotal}` );
//   console.log(`Final Total Tax: ${roundedTotalTaxAmount} , Provided ${cleanedData.totalTaxAmount}` );
//   // console.log(`Final Transaction Discount Amount: ${roundedTransactionDiscountAmount} , Provided ${cleanedData.transactionDiscountAmount}` );
//   console.log(`Final Total Amount: ${roundedGrandTotalAmount} , Provided ${cleanedData.grandTotal}` );
//   console.log(`Final Total Discount Amount: ${transactionDiscount} , Provided ${cleanedData.transactionDiscountAmount}` );

//   const cleanedDataTotalTax = cleanedData.totalTaxAmount || 0;

//   const isSubTotalCorrect = roundedSubTotal === parseFloat(cleanedData.subTotal);
//   const isTotalTaxCorrect = roundedTotalTaxAmount === parseFloat(cleanedDataTotalTax);
//   const isTotalAmountCorrect = roundedGrandTotalAmount === parseFloat(cleanedData.grandTotal);
//   const isTotalDiscount = transactionDiscount === parseFloat(cleanedData.transactionDiscountAmount);
//   const isTotalItemCount = totalItemCount === parseFloat(cleanedData.totalItem);



//   validateAmount(roundedSubTotal, cleanedData.subTotal, 'SubTotal', errors);
//   validateAmount(roundedTotalTaxAmount, cleanedData.totalTaxAmount, 'Total Tax', errors);
//   validateAmount(roundedGrandTotalAmount, cleanedData.grandTotal, 'Total Amount', errors);
//   validateAmount(transactionDiscount, cleanedData.transactionDiscountAmount, 'Total Discount Amount', errors);
//   validateAmount(totalItemCount, cleanedData.totalItem, 'Total Item count', errors);

//   if (errors.length > 0) {
//     res.status(400).json({ message: errors.join(", ") });
//     return false;
//   }

//   return true;
// }


// // Calculate item discount
// function calculateItemDiscount(item) {
//   return item.itemDiscountType === 'currency'
//     ? item.itemDiscount || 0
//     : (item.itemCostPrice * item.itemQuantity * (item.itemDiscount || 0)) / 100;    //if percentage
// }

// //Item Line Log
// function logCalculatedTax(item, calculatedCgstAmount, calculatedSgstAmount,  calculatedIgstAmount, calculatedVatAmount) {
//   console.log("");  
//   console.log(`Item: ${item.itemName}, Calculated CGST: ${calculatedCgstAmount}, CGST from data: ${item.cgstAmount}`);
//   console.log(`Item: ${item.itemName}, Calculated SGST: ${calculatedSgstAmount}, SGST from data: ${item.sgstAmount}`);
//   console.log(`Item: ${item.itemName}, Calculated IGST: ${calculatedIgstAmount}, IGST from data: ${item.igstAmount}`);
//   console.log(`Item: ${item.itemName}, Calculated VAT: ${calculatedVatAmount}, VAT from data: ${item.vatAmount}`);
// }

// //Mismatch Check
// function checkAmount(calculatedAmount, providedAmount, itemName, taxType,errors) {
//   if (Math.abs(calculatedAmount - providedAmount) > 0.01) {
//     const errorMessage = `Mismatch in ${taxType} for item ${itemName}: Calculated ${calculatedAmount}, Provided ${providedAmount}`;
//     errors.push(errorMessage);
//     console.log(errorMessage);
//   }
// }

// //TransactionDiscount
// function calculateTransactionDiscount(cleanedData, transactionDiscountAmount, total) {

//   const transactionDiscountAmount = cleanedData.transactionDiscount || 0;

//   return cleanedData.transactionDiscountType === 'currency'
//     ? transactionDiscountAmount
//     : (total * cleanedData.transactionDiscount) / 100;    //if percentage
// }

// //Final Item Amount check
// const validateAmount = ( calculatedValue, cleanedValue, label, errors ) => {
//   const isCorrect = calculatedValue === parseFloat(cleanedValue);
//   if (!isCorrect) {
//     const errorMessage = `${label} is incorrect: ${cleanedValue}`;
//     errors.push(errorMessage);
//     console.log(errorMessage);
//   }
// };








// Get last debit note prefix
exports.getLastDebitNotePrefix = async (req, res) => {
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
  validateReqFields( data, errors );
  validateItemTable(items, itemTable, errors);
  validateBillData(data, billExist, errors);
  validateTransactionDiscountType(data.transactionDiscountType, errors);
  // console.log("billExist Data:", billExist.billNumber, billExist.billDate, billExist.orderNumber)

  //OtherDetails
  validateIntegerFields(['totalItem'], data, errors);
  validateFloatFields(['transactionDiscountAmount', 'subTotal','cgst','sgst','igst','vat','totalTaxAmount','grandTotal'], data, errors);
  //validateAlphabetsFields(['department', 'designation'], data, errors);

  //Tax Details
  //validateTaxType(data.taxType, validTaxTypes, errors);
  validateSourceOfSupply(data.sourceOfSupply, organizationExists, errors);
  validateDestinationOfSupply(data.destinationOfSupply, organizationExists, errors);
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
function validateReqFields( data, errors ) {
validateField( typeof data.supplierId === 'undefined' || typeof data.supplierDisplayName === 'undefined', "Please select a Supplier", errors  );
validateField( typeof data.sourceOfSupply === 'undefined', "Source of supply required", errors  );
validateField( typeof data.destinationOfSupply === 'undefined', "Destination of supply required", errors  );
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

  // Validate selling price
  validateField( item.itemCostPrice !== fetchedItem.costPrice, `Cost price Mismatch for ${item.itemName}:  ${item.itemCostPrice}`, errors );

  // Validate CGST
  validateField( item.itemCgst !== fetchedItem.cgst, `CGST Mismatch for ${item.itemName}: ${item.itemCgst}`, errors );

  // Validate SGST
  validateField( item.itemSgst !== fetchedItem.sgst, `SGST Mismatch for ${item.itemName}: ${item.itemSgst}`, errors );

  // Validate IGST
  validateField( item.itemIgst !== fetchedItem.igst, `IGST Mismatch for ${item.itemName}: ${item.itemIgst}`, errors );

  // Validate tax group
  validateField( item.itemTaxGroup !== fetchedItem.taxRate, `Tax Group mismatch for ${item.itemName}: ${item.itemTaxGroup}`, errors );

  // Validate discount type
  validateItemDiscountType(item.itemDiscountType, errors);

  // Validate integer fields
  validateIntegerFields(['itemQuantity'], item, errors);

  // Validate float fields
  validateFloatFields(['itemCostPrice', 'itemTotaltax', 'itemAmount'], item, errors);
});
}


function validateBillData(data, billExist, errors) {
  // Validate billDate 
  validateField( typeof billExist.billDate !== data.billDate, `Bill Date mismatch for ${billExist.billDate}`, errors  );
  // Validate orderNumber 
  validateField( typeof billExist.orderNumber !== data.orderNumber, `Order Number mismatch for ${billExist.orderNumber}`, errors  );
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

//Validate Discount Transaction Type
function validateTransactionDiscountType(transactionDiscountType, errors) {
validateField(transactionDiscountType && !validTransactionDiscountType.includes(transactionDiscountType),
  "Invalid Discount: " + transactionDiscountType, errors);
} 

//Validate Item Discount Transaction Type
function validateItemDiscountType(itemDiscountType, errors) {
  validateField(itemDiscountType && !validItemDiscountType.includes(itemDiscountType),
    "Invalid Discount: " + itemDiscountType, errors);
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




// Utility functions
const validItemDiscountType = ["percentage", "currency"];
const validTransactionDiscountType = ["percentage", "currency"];
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

