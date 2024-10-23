// v1.0

const Organization = require("../database/model/organization");
const Item = require("../database/model/item");
const Account = require("../database/model/account");
const Customer = require("../database/model/customer");
const moment = require("moment-timezone");
const Settings = require("../database/model/settings")
const Order = require("../database/model/salesOrder")
const ItemTrack = require("../database/model/itemTrack")
const Prefix = require("../database/model/prefix");
const mongoose = require('mongoose');


// Fetch existing data
const dataExist = async ( organizationId, items, customerId, customerName ) => {
  const itemIds = items.map(item => item.itemId);
  
    const [organizationExists, customerExist , settings, itemTable, itemTrack, existingPrefix  ] = await Promise.all([
      Organization.findOne({ organizationId }, { organizationId: 1, organizationCountry: 1, state: 1 }),
      Customer.findOne({ organizationId , _id:customerId, customerDisplayName: customerName}, { _id: 1, customerDisplayName: 1, taxType: 1 }),
      Settings.findOne({ organizationId },{ salesOrderAddress: 1, salesOrderCustomerNote: 1, salesOrderTermsCondition: 1, salesOrderClose: 1, restrictSalesOrderClose: 1, termCondition: 1 ,customerNote: 1 }),
      Item.find({ organizationId, _id: { $in: itemIds } }, { _id: 1, itemName: 1, taxPreference: 1, sellingPrice: 1, taxRate: 1, cgst: 1, sgst: 1, igst: 1, vat: 1 }),
      ItemTrack.find({ itemId: { $in: itemIds } }),
      Prefix.findOne({ organizationId })
    ]);
    return { organizationExists, customerExist , settings, itemTable, itemTrack, existingPrefix };
  };


// Add Sales Order
exports.addOrder = async (req, res) => {
    console.log("Add Sales Order :", req.body);
    try {
      const { organizationId, id: userId, userName } = req.user;

      //Clean Data
      const cleanedData = cleanCustomerData(req.body);

      const { items } = cleanedData;
      const { customerId, customerName } = cleanedData;
      const itemIds = items.map(item => item.itemId);

      // Check for duplicate itemIds
      const uniqueItemIds = new Set(itemIds);
      if (uniqueItemIds.size !== itemIds.length) {
        return res.status(400).json({ message: "Duplicate Item found" });
      }


      //Validate Customer
      if (!mongoose.Types.ObjectId.isValid(customerId) || customerId.length !== 24) {
        return res.status(400).json({ message: `Invalid customer ID: ${customerId}` });
      }
      // Validate ItemIds
      const invalidItemIds = itemIds.filter(itemId => !mongoose.Types.ObjectId.isValid(itemId) || itemId.length !== 24);
      if (invalidItemIds.length > 0) {
        return res.status(400).json({ message: `Invalid item IDs: ${invalidItemIds.join(', ')}` });
      }   
  
      const { organizationExists, customerExist , settings, itemTable, itemTrack, existingPrefix } = await dataExist( organizationId, items, customerId, customerName );
      
      
      //Data Exist Validation
      if (!validateOrganizationTaxCurrency( organizationExists, customerExist, existingPrefix, res )) return;
      
      //Date & Time
      const openingDate = generateOpeningDate(organizationExists);

      //Validate Inputs  
      if (!validateInputs( cleanedData, customerExist, items, itemTable, organizationExists, res)) return;

      //Tax Type
      taxtype(cleanedData, customerExist,organizationExists );

      // Calculate Sales 
      if (!calculateSalesOrder( cleanedData, res )) return;

      // console.log('Calculation Result:', result);
      //Prefix
      await salesPrefix(cleanedData, existingPrefix );
      
      const savedOrder = await createNewOrder(cleanedData, openingDate, organizationId, userId, userName );
        
      res.status(201).json({ message: "Sale Order created successfully" });
      console.log( "Sale Order created successfully:", savedOrder );
    } catch (error) {
      console.error("Error Creating Sales Order:", error);
      res.status(500).json({ message: "Internal server error." });
    }
  };




// Get Last Order Prefix
exports.getLastOrderPrefix = async (req, res) => {
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
      const lastPrefix = series.salesOrder + series.salesOrderNum;
      console.log(lastPrefix);

      res.status(200).json(lastPrefix);
  } catch (error) {
      console.error("Error fetching accounts:", error);
      res.status(500).json({ message: "Internal server error." });
  }
};










// Utility Functions
const validShipmentPreference = [];
const validPaymentMode = [];
const validDiscountTransactionType = ["Currency", "Percentage"];
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

  
//Clean Data 
function cleanCustomerData(data) {
  const cleanData = (value) => (value === null || value === undefined || value === "" ? undefined : value);
  return Object.keys(data).reduce((acc, key) => {
    acc[key] = cleanData(data[key]);
    return acc;
  }, {});
}

// Validate Organization Tax Currency
function validateOrganizationTaxCurrency( organizationExists, customerExist, existingPrefix, res ) {
  if (!organizationExists) {
    res.status(404).json({ message: "Organization not found" });
    return false;
  }
  if (!customerExist) {
    res.status(404).json({ message: "Customer not found" });
    return false;
  }
  if (!existingPrefix) {
    res.status(404).json({ message: "Prefix not found" });
    return false;
  }
  return true;
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
 



















//Validate inputs
function validateInputs( data, customerExist, items, itemExists, organizationExists, res) {
  const validationErrors = validateQuoteData(data, customerExist, items, itemExists, organizationExists);

  if (validationErrors.length > 0) {
    res.status(400).json({ message: validationErrors.join(", ") });
    return false;
  }
  return true;
}

// Create New Order
function createNewOrder( data, openingDate, organizationId, userId, userName ) {
    const newOrder = new Order({ ...data, organizationId, createdDate: openingDate, userId, userName });
    return newOrder.save();
}
  

// Sales Prefix
function salesPrefix( cleanData, existingPrefix ) {
  const activeSeries = existingPrefix.series.find(series => series.status === true);
  if (!activeSeries) {
      return res.status(404).json({ message: "No active series found for the organization." });
  }
  cleanData.salesOrder = `${activeSeries.salesOrder}${activeSeries.salesOrderNum}`;

  activeSeries.salesOrderNum += 1;

  existingPrefix.save()

  return 
}

  
// Tax Type
function taxtype( cleanedData, customerExist, organizationExists ) {
  if(customerExist.taxType === 'GST' ){
    if(cleanedData.placeOfSupply === organizationExists.state){
      cleanedData.taxType ='Intra';
    }
    else{
      cleanedData.taxType ='Inter';
    }
  }
  if(customerExist.taxType === 'VAT' ){
    cleanedData.taxType ='VAT';
  }
  if(customerExist.taxType === 'Non-Tax' ){
    cleanedData.taxType ='Non-Tax';
  }  
  return  
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



  





  





//Validate Data
function validateQuoteData( data, customerExist, items, itemTable, organizationExists ) {
  const errors = [];

  console.log("Item Request :",items);
  console.log("Item Fetched :",itemTable);
  

  //Basic Info
  validateReqFields( data, errors );
  validateItemTable(items, itemTable, errors);
  // validateDiscountType(data.discountType, errors);
  validateDiscountTransactionType(data.discountTransactionType, errors);
  //validateDiscountTax(data.discountTax, errors);
  validateShipmentPreference(data.shipmentPreference, errors);
  validatePaymentMode(data.paymentMode, errors);


  //OtherDetails
  //validateAlphanumericFields([''], data, errors);
  validateIntegerFields(['totalItem'], data, errors);
  validateFloatFields(['discountTransactionAmount', 'subTotal','cgst','sgst','igst','vat','totalTax','totalAmount','totalDiscount','otherExpenseAmount','freightAmount','roundOffAmount'], data, errors);
  //validateAlphabetsFields([''], data, errors);

  //Tax Details
  validatePlaceOfSupply(data.placeOfSupply, organizationExists, errors);

  return errors;
}

// Field validation utility
function validateField(condition, errorMsg, errors) {
  if (condition) errors.push(errorMsg);
}
//Valid Req Fields
function validateReqFields( data, errors ) {
validateField( typeof data.customerId === 'undefined' || typeof data.customerName === 'undefined', "Please select a Customer", errors  );
validateField( typeof data.placeOfSupply === 'undefined', "Place of supply required", errors  );
validateField( typeof data.items === 'undefined', "Select an item", errors  );
validateField( typeof data.otherExpenseAmount !== 'undefined' && typeof data.otherExpenseReason === 'undefined', "Please enter other expense reason", errors  );
validateField( !(data.roundOffAmount >= 0 && data.roundOffAmount <= 1), " Round Off Amount must be between 0 and 1", errors );

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
  validateField( item.sellingPrice !== fetchedItem.sellingPrice, `Selling price Mismatch for ${item.itemName}:  ${item.sellingPrice}`, errors );

  // Validate CGST
  validateField( item.cgst !== fetchedItem.cgst, `CGST Mismatch for ${item.itemName}: ${item.cgst}`, errors );

  // Validate SGST
  validateField( item.sgst !== fetchedItem.sgst, `SGST Mismatch for ${item.itemName}: ${item.sgst}`, errors );

  // Validate IGST
  validateField( item.igst !== fetchedItem.igst, `IGST Mismatch for ${item.itemName}: ${item.igst}`, errors );

  // Validate tax group
  validateField( item.taxGroup !== fetchedItem.taxRate, `Tax Group mismatch for ${item.itemName}: ${item.taxGroup}`, errors );

  // Validate discount type
  validateDiscountTransactionType(item.discountType, errors);

  // Validate integer fields
  validateIntegerFields(['quantity'], item, errors);

  // Validate float fields
  validateFloatFields(['sellingPrice', 'itemTotaltax', 'discountAmount', 'amount'], item, errors);
});
}


// Validate Place Of Supply
function validatePlaceOfSupply(placeOfSupply, organization, errors) {
  validateField(
    placeOfSupply && !validCountries[organization.organizationCountry]?.includes(placeOfSupply),
    "Invalid Place of Supply: " + placeOfSupply, errors );
}

//Validate Discount Type
// function validateDiscountType(discountType, errors) {
// validateField(discountType && !validDiscountType.includes(discountType),
//   "Invalid Discount Type: " + discountType, errors);
// }
//Validate Discount Transaction Type
function validateDiscountTransactionType(discountTransactionType, errors) {
validateField(discountTransactionType && !validDiscountTransactionType.includes(discountTransactionType),
  "Invalid Discount: " + discountTransactionType, errors);
}
//Validate Discount Transaction Type
// function validateDiscountTax(discountTax, errors) {
// validateField(discountTax && !validDiscountTax.includes(discountTax),
//   "Invalid Discount : " + discountTax, errors);
// } 
//Validate Shipment Preference
function validateShipmentPreference(shipmentPreference, errors) {
  validateField(shipmentPreference && !validShipmentPreference.includes(shipmentPreference),
    "Invalid Shipment Preference : " + shipmentPreference, errors);
}
//Validate Payment Mode
function validatePaymentMode(paymentMode, errors) {
  validateField(paymentMode && !validPaymentMode.includes(paymentMode),
    "Invalid Payment Mode : " + paymentMode, errors);
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



function calculateSalesOrder(cleanedData, res) {
  const errors = [];
  let totalAmount = 0;
  let subTotal = 0;
  let totalTax = 0;
  let totalDiscount= 0;
  let totalItemCount = 0;


  cleanedData.items.forEach(item => {
    let discountAmount = 0;

    // Calculate item line discount if applicable
    // if (cleanedData.discountType === 'Item Line' || cleanedData.discountType === 'Both') {
      discountAmount = item.discountType === 'Currency'
        ? item.discountAmount
        : (item.sellingPrice * item.quantity * item.discountAmount) / 100;
    // }

    totalDiscount +=  parseFloat(discountAmount);
    totalItemCount +=  parseFloat(item.quantity);


    let itemTotal = (item.sellingPrice * item.quantity) - discountAmount;
    let calculatedCgstAmount = 0;
    let calculatedSgstAmount = 0;
    let calculatedIgstAmount = 0;
    let calculatedVatAmount = 0;
    let calculatedTaxAmount = 0;
    let taxType = cleanedData.taxType;

    // Handle tax calculation only for taxable items
    if (item.taxPreference === 'Taxable') {
      if (taxType === 'Intra') {
        // Apply CGST + SGST for Intra
        calculatedCgstAmount = (item.cgst / 100) * itemTotal;
        calculatedSgstAmount = (item.sgst / 100) * itemTotal;
        itemTotal += calculatedCgstAmount + calculatedSgstAmount;
      } else if (taxType === 'Inter') {
        // Apply IGST for Inter
        calculatedIgstAmount = (item.igst / 100) * itemTotal;
        itemTotal += calculatedIgstAmount;
      } else if (taxType === 'VAT') {
        // Apply VAT
        calculatedVatAmount = (item.vat / 100) * itemTotal;
        itemTotal += calculatedVatAmount;
      }
      calculatedTaxAmount =  calculatedCgstAmount + calculatedSgstAmount + calculatedIgstAmount + calculatedVatAmount;
      
      // Log calculated tax amounts
      console.log(`Item: ${item.itemName}, Calculated CGST: ${calculatedCgstAmount}, CGST from data: ${item.cgstAmount}`);
      console.log(`Item: ${item.itemName}, Calculated SGST: ${calculatedSgstAmount}, SGST from data: ${item.sgstAmount}`);
      console.log(`Item: ${item.itemName}, Calculated IGST: ${calculatedIgstAmount}, IGST from data: ${item.igstAmount}`);
      console.log(`Item: ${item.itemName}, Calculated VAT: ${calculatedVatAmount}, VAT from data: ${item.vatAmount}`);


      // Check tax amounts
      if (Math.abs(calculatedCgstAmount - item.cgstAmount) > 0.01) {
        errors.push(`Mismatch in CGST for item ${item.itemName}: Calculated ${calculatedCgstAmount}, Provided ${item.cgstAmount}`);
        console.log(`Mismatch in CGST for item ${item.itemName}: Calculated ${calculatedCgstAmount}, Provided ${item.cgstAmount}`);
      }
      if (Math.abs(calculatedSgstAmount - item.sgstAmount) > 0.01) {
        errors.push(`Mismatch in SGST for item ${item.itemName}: Calculated ${calculatedSgstAmount}, Provided ${item.sgstAmount}`);
        console.log(`Mismatch in SGST for item ${item.itemName}: Calculated ${calculatedSgstAmount}, Provided ${item.sgstAmount}`);
      }
      if (Math.abs(calculatedIgstAmount - item.igstAmount) > 0.01) {
        errors.push(`Mismatch in IGST for item ${item.itemName}: Calculated ${calculatedIgstAmount}, Provided ${item.igstAmount}`);
        console.log(`Mismatch in IGST for item ${item.itemName}: Calculated ${calculatedIgstAmount}, Provided ${item.igstAmount}`);
      }
      if (Math.abs(calculatedVatAmount - item.vatAmount) > 0.01) {
        errors.push(`Mismatch in VAT for item ${item.itemName}: Calculated ${calculatedVatAmount}, Provided ${item.vatAmount}`);
        console.log(`Mismatch in VAT for item ${item.itemName}: Calculated ${calculatedVatAmount}, Provided ${item.vatAmount}`);
      }
      if (Math.abs(calculatedTaxAmount - item.itemTotaltax) > 0.01) {
        errors.push(`Mismatch in Total tax for item ${item.itemName}: Calculated ${calculatedTaxAmount}, Provided ${item.itemTotaltax}`);
        console.log(`Mismatch in Total tax for item ${item.itemName}: Calculated ${calculatedTaxAmount}, Provided ${item.itemTotaltax}`);
      }
    } else {
      console.log(`Skipping tax for non-taxable item: ${item.itemName}`);
      console.log(`Item: ${item.itemName}, Calculated Discount: ${totalDiscount}`);

    }

    // Update total values
    subTotal += parseFloat(itemTotal);

    // Only add to totalTax if the item is taxable
    if (item.taxPreference === 'Taxable') {
      totalTax += calculatedCgstAmount + calculatedSgstAmount + calculatedIgstAmount + calculatedVatAmount || 0 ;
    }

    console.log(`${item.itemName} Item Total: ${itemTotal} , Provided ${item.amount}`);
    console.log(`${item.itemName} Total Tax: ${calculatedTaxAmount} , Provided ${item.itemTotaltax || 0 }`);
    console.log("");
  });

  if(cleanedData.otherExpenseAmount){
    subTotal +=  parseFloat(cleanedData.otherExpenseAmount);
    console.log("Other Expense Amount", cleanedData.otherExpenseAmount);    
  }
  if(cleanedData.freightAmount){
    subTotal +=  parseFloat(cleanedData.freightAmount);
    console.log("Freight Amount", cleanedData.freightAmount);    
  }
  if(cleanedData.roundOffAmount){
    subTotal -=  parseFloat(cleanedData.roundOffAmount);
    console.log("Round Off Amount", cleanedData.roundOffAmount);    
  }

  let transactionDiscount = 0;

  // Apply transaction level discount if applicable
  
    if (cleanedData.discountTransactionType === 'Currency') {
      transactionDiscount = cleanedData.discountTransactionAmount;
    } else {
      // Percentage-based transaction discount
      transactionDiscount = (subTotal * cleanedData.discountTransactionAmount) / 100;
    }

  totalDiscount +=  parseFloat(transactionDiscount);

  

  console.log(`SubTotal: ${subTotal} , Provided ${cleanedData.subTotal}`);

  // Total amount calculation
  totalAmount = subTotal ;

  // Apply transaction discount after tax if needed
  // if (cleanedData.discountType === 'Transaction Line' || cleanedData.discountType === 'Both') {
  //   if (cleanedData.discountTax === 'After') {
      totalAmount -= transactionDiscount;
  //   }
  // }
  

  // Utility function to round values to two decimal places
  const roundToTwoDecimals = (value) => Math.round(value * 100) / 100;

  // Validate calculated totals against cleanedData data
  const calculatedSubTotal = subTotal;
  const calculatedTotalTax = totalTax;
  const calculatedTotalAmount = totalAmount;

  // Round the totals for comparison
  const roundedSubTotal = roundToTwoDecimals(calculatedSubTotal);
  const roundedTotalTax = roundToTwoDecimals(calculatedTotalTax);
  const roundedTotalAmount = roundToTwoDecimals(calculatedTotalAmount);

  console.log(`Final Sub Total: ${roundedSubTotal} , Provided ${cleanedData.subTotal}` );
  console.log(`Final Total Tax: ${roundedTotalTax} , Provided ${cleanedData.totalTax}` );
  console.log(`Final Total Amount: ${roundedTotalAmount} , Provided ${cleanedData.totalAmount}` );
  console.log(`Final Total Discount Amount: ${totalDiscount} , Provided ${cleanedData.totalDiscount}` );

  const cleanedDataTotalTax = cleanedData.totalTax || 0;

  const isSubTotalCorrect = roundedSubTotal === parseFloat(cleanedData.subTotal);
  const isTotalTaxCorrect = roundedTotalTax === parseFloat(cleanedDataTotalTax);
  const isTotalAmountCorrect = roundedTotalAmount === parseFloat(cleanedData.totalAmount);
  const isTotalDiscount = totalDiscount === parseFloat(cleanedData.totalDiscount);
  const isTotalItemCount = totalItemCount === parseFloat(cleanedData.totalItem);



  if (!isSubTotalCorrect) {
    errors.push(`SubTotal is incorrect: ${cleanedData.subTotal}`);
    console.log(`SubTotal is incorrect: ${cleanedData.subTotal}`);    
  }
  if (!isTotalTaxCorrect) {
    errors.push(`Total Tax is incorrect: ${cleanedData.totalTax}`);
    console.log(`Total Tax is incorrect: ${cleanedData.totalTax}`);   
  }
  if (!isTotalAmountCorrect) {
    errors.push(`Total Amount is incorrect: ${cleanedData.totalAmount}`);
    console.log(`Total Amount is incorrect: ${cleanedData.totalAmount}`);   
  }
  if (!isTotalDiscount) {
    errors.push(`Total Discount Amount is incorrect: ${cleanedData.totalDiscount}`);
    console.log(`Total Discount Amount is incorrect: ${cleanedData.totalDiscount}`);   
  }
  if (!isTotalItemCount) {
    errors.push(`Total Item count is incorrect: ${cleanedData.totalItem}`);
    console.log(`Total Item count is incorrect: ${cleanedData.totalItem}`);   
  }

  if (errors.length > 0) {
    res.status(400).json({ message: errors.join(", ") });
    return false;
  }

  return true;
}