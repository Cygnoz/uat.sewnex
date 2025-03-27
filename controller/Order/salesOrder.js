// v1.0

const Organization = require("../../database/model/organization");
const Item = require("../../database/model/item");
const Customer = require("../../database/model/customer");
const Settings = require("../../database/model/settings")
const Order = require("../../database/model/salesOrder")
const ItemTrack = require("../../database/model/itemTrack")
const Prefix = require("../../database/model/prefix");
const CustomerHistory = require("../../database/model/customerHistory");
const mongoose = require('mongoose');

const { cleanData } = require("../../services/cleanData");
const { singleCustomDateTime, multiCustomDateTime } = require("../../services/timeConverter");



// Fetch existing data
const dataExist = async ( organizationId, customerId ) => { 
    const [organizationExists, customerExist , settings, existingPrefix  ] = await Promise.all([
      Organization.findOne({ organizationId }, { organizationId: 1, organizationCountry: 1, state: 1, }),
      Customer.findOne({ organizationId , _id:customerId}, { _id: 1, customerDisplayName: 1, taxType: 1 }),
      Settings.findOne({ organizationId },{ stockBelowZero:1, salesOrderAddress: 1, salesOrderCustomerNote: 1, salesOrderTermsCondition: 1, salesOrderClose: 1, restrictSalesOrderClose: 1, termCondition: 1 ,customerNote: 1 }),
      Prefix.findOne({ organizationId }),
    ]);
    return { organizationExists, customerExist , settings, existingPrefix };
};

//Fetch Item Data
const newDataExists = async (organizationId,items) => {
          // Retrieve items with specified fields
          const itemIds = items.map(item => new mongoose.Types.ObjectId(item.itemId));

          const [newItems] = await Promise.all([
            Item.find( { organizationId, _id: { $in: itemIds } },
            { _id: 1, itemName: 1, taxPreference: 1, sellingPrice: 1, costPrice: 1, taxRate: 1, cgst: 1, sgst: 1, igst: 1, vat: 1 }
            ).lean()
          ]);
        
          // Aggregate ItemTrack data to calculate current stock
          const itemTracks = await ItemTrack.aggregate([
            { $match: { itemId: { $in: itemIds } } },
            {
                $group: {
                    _id: "$itemId",
                    totalCredit: { $sum: "$creditQuantity" },
                    totalDebit: { $sum: "$debitQuantity" },
                    lastEntry: { $max: "$createdDateTime" } // Capture the latest entry time for each item
                }
            }
          ]);
      
          // Map itemTracks for easier lookup
          const itemTrackMap = itemTracks.reduce((acc, itemTrack) => {
              acc[itemTrack._id.toString()] = {
                  currentStock: itemTrack.totalDebit - itemTrack.totalCredit, // Calculate stock as debit - credit
                  lastEntry: itemTrack.lastEntry
              };
              return acc;
            }, {});
      
          // Enrich newItems with currentStock data
          const itemTable = newItems.map(item => ({
              ...item,
              currentStock: itemTrackMap[item._id.toString()]?.currentStock ?? 0, // Use 0 if no track data
              // lastEntry: itemTrackMap[item._id.toString()]?.lastEntry || null // Include the latest entry timestamp
          }));
      
        return { itemTable };
};


const salesDataExist = async ( organizationId, orderId ) => {    
  const [organizationExists, allOrder, order ] = await Promise.all([
    Organization.findOne({ organizationId }, { organizationId: 1,timeZoneExp: 1, dateFormatExp: 1, dateSplit: 1}),
    Order.find({ organizationId })
    .populate('customerId', 'customerDisplayName')    
    .lean(),
    Order.findOne({ organizationId , _id: orderId })
    .populate('items.itemId', 'itemName cgst sgst igst vat salesAccountId itemImage')    
    .populate('customerId', 'customerDisplayName')    
    .lean(),
  ]);
  return { organizationExists, allOrder, order };
};


// Add Sales Order
exports.addOrder = async (req, res) => {
    console.log("Add Sales Order :", req.body);
    try {
      const { organizationId, id: userId, userName } = req.user;

      //Clean Data
      const cleanedData = cleanData(req.body);

      const { items, customerId, customerName } = cleanedData;
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
  
      const { organizationExists, customerExist , settings, existingPrefix } = await dataExist( organizationId, customerId );

      const { itemTable } = await newDataExists( organizationId, items );
      
      //Data Exist Validation
      if (!validateOrganizationTaxCurrency( organizationExists, customerExist, existingPrefix, res )) return;
      

      //Validate Inputs  
      if (!validateInputs( cleanedData, settings, customerExist, items, itemTable, organizationExists, res)) return;

      //Tax Type
      taxType(cleanedData, customerExist,organizationExists );

      // Calculate Sales 
      if (!calculateSalesOrder( cleanedData, res )) return;

      //Prefix
      await salesPrefix(cleanedData, existingPrefix );
      
      const savedOrder = await createNewOrder(cleanedData, organizationId, userId, userName );

      // Add entry to Customer History
      const customerHistoryEntry = new CustomerHistory({
        organizationId,
        operationId: savedOrder._id,
        customerId,
        title: "Sales Order Added",
        description: `Sales order ${savedOrder.salesOrder} of amount ${savedOrder.totalAmount} created by ${userName}`,
        userId: userId,
        userName: userName,
      });
  
      await customerHistoryEntry.save();
        
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

      res.status(200).json(lastPrefix);
  } catch (error) {
      console.error("Error fetching accounts:", error);
      res.status(500).json({ message: "Internal server error." });
  }
};




// Get All Sales Order
exports.getAllSalesOrder = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const { organizationExists, allOrder } = await salesDataExist( organizationId, null );

    if (!organizationExists) {
      return res.status(404).json({ message: "Organization not found" });
    }

    if (!allOrder) {
      return res.status(404).json({ message: "No Order found" });
    }

    const transformedInvoice = allOrder.map(data => {
      return {
          ...data,
          customerId: data.customerId?._id,  
          customerDisplayName: data.customerId?.customerDisplayName,  
      };});
      
    const formattedObjects = multiCustomDateTime(transformedInvoice, organizationExists.dateFormatExp, organizationExists.timeZoneExp, organizationExists.dateSplit );    


    res.status(200).json(formattedObjects);
  } catch (error) {
    console.error("Error fetching Order:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};



// Get One Sales Order
exports.getOneSalesOrder = async (req, res) => {
try {
  const organizationId = req.user.organizationId;
  const orderId  = req.params.orderId;

  if ( !orderId || orderId.length !== 24 ) return res.status(404).json({ message: "No Order found" });
  
  const { organizationExists, order } = await salesDataExist( organizationId, orderId );

  if (!organizationExists) return res.status(404).json({ message: "Organization not found" });

  if (!order) return res.status(404).json({ message: "No Order found" });
  
  const transformedInvoice = {
    ...order,
    customerId: order.customerId?._id,  
    customerDisplayName: order.customerId?.customerDisplayName,
    items: order.items.map(item => ({
      ...item,
      itemId: item.itemId?._id,
      itemName: item.itemId?.itemName,
      cgst: item.itemId?.cgst,
      sgst: item.itemId?.sgst,
      igst: item.itemId?.igst,
      vat: item.itemId?.vat,      
      salesAccountId: item.itemId?.salesAccountId,
      itemImage: item.itemId?.itemImage,
    })),  
};


const formattedObjects = singleCustomDateTime(transformedInvoice, organizationExists.dateFormatExp, organizationExists.timeZoneExp, organizationExists.dateSplit );    


  res.status(200).json(formattedObjects);
} catch (error) {
  console.error("Error fetching Order:", error);
  res.status(500).json({ message: "Internal server error." });
}
};









// Utility Functions
const validDeliveryMethod = ["Road","Rail","Air","Sea"];
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
  





















//Validate inputs
function validateInputs( data, settings, customerExist, items, itemExists, organizationExists, res) {
  const validationErrors = validateOrderData(data, settings, customerExist, items, itemExists, organizationExists );

  if (validationErrors.length > 0) {
    res.status(400).json({ message: validationErrors.join(", ") });
    return false;
  }
  return true;
}

// Create New Order
function createNewOrder( data, organizationId, userId, userName ) {
    const newOrder = new Order({ ...data, organizationId, status :"Sent", userId, userName });
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
 
}

  
// Tax Type
function taxType( cleanedData, customerExist, organizationExists ) {
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
}


  


  


  
  




  



  





  





//Validate Data
function validateOrderData( data, settings, customerExist, items, itemTable, organizationExists ) {
  const errors = [];

  //Basic Info
  validateReqFields( data, errors );
  validateItemTable(items, settings, itemTable, errors);
  validateDiscountTransactionType(data.discountTransactionType, errors);
  validateDeliveryMethod(data.deliveryMethod, errors);
  // validatePaymentMode(data.paymentMode, errors);


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
validateField( typeof data.customerId === 'undefined', "Please select a Customer", errors  );
validateField( typeof data.placeOfSupply === 'undefined', "Place of supply required", errors  );
validateField( typeof data.items === 'undefined', "Select an item", errors  );
validateField( typeof data.otherExpenseAmount !== 'undefined' && typeof data.otherExpenseReason === 'undefined', "Please enter other expense reason", errors  );
validateField( typeof data.roundOffAmount !== 'undefined' && !(data.roundOffAmount >= 0 && data.roundOffAmount <= 1), " Round Off Amount must be between 0 and 1", errors );
}
// Function to Validate Item Table 
function validateItemTable(items, settings, itemTable, errors) {
// Check for item count mismatch
validateField( items.length !== itemTable.length, "Mismatch in item count between request and database.", errors  );

// Iterate through each item to validate individual fields
items.forEach((item) => {
  const fetchedItem = itemTable.find(it => it._id.toString() === item.itemId);
  console.log("itemTable type:", typeof itemTable);
  console.log("itemTable:", itemTable);

  

  // Check if item exists in the item table
  validateField( !fetchedItem, `Item with ID ${item.itemId} was not found.`, errors );
  if (!fetchedItem) return; 

  // Validate item name
  validateField( item.itemName !== fetchedItem.itemName, `Item Name Mismatch : ${item.itemName}`, errors );

  // Validate selling price
  // validateField( item.sellingPrice !== fetchedItem.sellingPrice, `Selling price Mismatch for ${item.itemName}:  ${item.sellingPrice}`, errors );

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

  // Validate Stock Count 
  validateField( settings.stockBelowZero === true && item.quantity > fetchedItem.currentStock, `Insufficient Stock for ${item.itemName}: Requested quantity ${item.quantity}, Available stock ${fetchedItem.currentStock}`, errors );

  // Validate float fields
  validateFloatFields(['sellingPrice', 'itemTotalTax', 'discountAmount', 'itemAmount'], item, errors);
});
}


// Validate Place Of Supply
function validatePlaceOfSupply(placeOfSupply, organization, errors) {
  validateField(
    placeOfSupply && !validCountries[organization.organizationCountry]?.includes(placeOfSupply),
    "Invalid Place of Supply: " + placeOfSupply, errors );
}


//Validate Discount Transaction Type
function validateDiscountTransactionType(discountTransactionType, errors) {
validateField(discountTransactionType && !validDiscountTransactionType.includes(discountTransactionType),
  "Invalid Discount: " + discountTransactionType, errors);
}

//Validate Shipment Preference
function validateDeliveryMethod(deliveryMethod, errors) {
  validateField(deliveryMethod && !validDeliveryMethod.includes(deliveryMethod),
    "Invalid Delivery Method : " + deliveryMethod, errors);
}
//Validate Payment Mode
// function validatePaymentMode(paymentMode, errors) {
//   validateField(paymentMode && !validPaymentMode.includes(paymentMode),
//     "Invalid Payment Mode : " + paymentMode, errors);
// }
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

  // Utility function to round values to two decimal places
  const roundToTwoDecimals = (value) => Number(value.toFixed(2));


  cleanedData.items.forEach(item => {

    let calculatedCgstAmount = 0;
    let calculatedSgstAmount = 0;
    let calculatedIgstAmount = 0;
    let calculatedVatAmount = 0;
    let calculatedTaxAmount = 0;
    let taxType = cleanedData.taxType;

    // Calculate item line discount 
    const discountAmount = calculateDiscount(item);

    totalDiscount +=  parseFloat(discountAmount);
    totalItemCount +=  parseFloat(item.quantity);

    let itemTotal = (item.sellingPrice * item.quantity) - discountAmount;
    

    // Handle tax calculation only for taxable items
    if (item.taxPreference === 'Taxable') {
      switch (taxType) {
        
        case 'Intra':
        calculatedCgstAmount = roundToTwoDecimals((item.cgst / 100) * itemTotal);
        calculatedSgstAmount = roundToTwoDecimals((item.sgst / 100) * itemTotal);
        itemTotal += calculatedCgstAmount + calculatedSgstAmount;
        break;

        case 'Inter':
        calculatedIgstAmount = roundToTwoDecimals((item.igst / 100) * itemTotal);
        itemTotal += calculatedIgstAmount;
        break;
        
        case 'VAT':
        calculatedVatAmount = roundToTwoDecimals((item.vat / 100) * itemTotal);
        itemTotal += calculatedVatAmount;
        break;

      }
      calculatedTaxAmount =  calculatedCgstAmount + calculatedSgstAmount + calculatedIgstAmount + calculatedVatAmount;
      
      
      // Check tax amounts
      checkAmount(calculatedCgstAmount, item.cgstAmount, item.itemName, 'CGST',errors);
      checkAmount(calculatedSgstAmount, item.sgstAmount, item.itemName, 'SGST',errors);
      checkAmount(calculatedIgstAmount, item.igstAmount, item.itemName, 'IGST',errors);
      checkAmount(calculatedVatAmount, item.vatAmount, item.itemName, 'VAT',errors);
      checkAmount(calculatedTaxAmount, item.itemTotalTax, item.itemName, 'Total tax',errors);

      totalTax += calculatedCgstAmount + calculatedSgstAmount + calculatedIgstAmount + calculatedVatAmount || 0 ;


    } else {
      console.log(`Skipping Tax for Non-Taxable item: ${item.itemName}`);
      console.log(`Item: ${item.itemName}, Calculated Discount: ${totalDiscount}`);

    }

    // Update total values
    subTotal += parseFloat(itemTotal);

    checkAmount(itemTotal, item.itemAmount, item.itemName, 'Item Total',errors);

    console.log(`${item.itemName} Item Total: ${itemTotal} , Provided ${item.itemAmount}`);
    console.log(`${item.itemName} Total Tax: ${calculatedTaxAmount} , Provided ${item.itemTotalTax || 0 }`);
    console.log("");
  });

  console.log(`SubTotal: ${subTotal} , Provided ${cleanedData.subTotal}`);
  
  //Other Expense
  totalAmount = otherExpense( subTotal, cleanedData );  
  console.log("After Other Expense: ",totalAmount);  

  // Transaction Discount
  let transactionDiscount = calculateTransactionDiscount(cleanedData, totalAmount);

  totalDiscount +=  parseFloat(transactionDiscount); 

  // Total amount calculation
  totalAmount -= transactionDiscount; 

  
  // Round the totals for comparison
  const roundedSubTotal = roundToTwoDecimals(subTotal);
  const roundedTotalTax = roundToTwoDecimals(totalTax);
  const roundedTotalAmount = roundToTwoDecimals(totalAmount);
  const roundedTotalDiscount = roundToTwoDecimals(totalDiscount);

  console.log(`Final Sub Total: ${roundedSubTotal} , Provided ${cleanedData.subTotal}` );
  console.log(`Final Total Tax: ${roundedTotalTax} , Provided ${cleanedData.totalTax}` );
  console.log(`Final Total Amount: ${roundedTotalAmount} , Provided ${cleanedData.totalAmount}` );
  console.log(`Final Total Discount Amount: ${roundedTotalDiscount} , Provided ${cleanedData.totalDiscount}` );

  validateAmount(roundedSubTotal, cleanedData.subTotal, 'SubTotal',errors);
  validateAmount(roundedTotalTax, cleanedData.totalTax, 'Total Tax',errors);
  validateAmount(roundedTotalAmount, cleanedData.totalAmount, 'Total Amount',errors);
  validateAmount(roundedTotalDiscount, cleanedData.totalDiscount, 'Total Discount Amount',errors);
  validateAmount(totalItemCount, cleanedData.totalItem, 'Total Item count',errors);

  if (errors.length > 0) {
    res.status(400).json({ message: errors.join(", ") });
    return false;
  }

  return true;
}




// Calculate item discount
function calculateDiscount(item) {
  return item.discountType === 'Currency'
    ? item.discountAmount || 0
    : (item.sellingPrice * item.quantity * (item.discountAmount || 0)) / 100;
}


//Mismatch Check
function checkAmount(calculatedAmount, providedAmount, itemName, taxType,errors) {
  const roundToTwoDecimals = (value) => Number(value.toFixed(2)); // Round to two decimal places
  const roundedAmount = roundToTwoDecimals(calculatedAmount);
  console.log(`Item: ${itemName}, Calculated ${taxType}: ${roundedAmount}, Provided data: ${providedAmount}`);

  
  if (Math.abs(roundedAmount - providedAmount) > 0.01) {
    const errorMessage = `Mismatch in ${taxType} for item ${itemName}: Calculated ${calculatedAmount}, Provided ${providedAmount}`;
    errors.push(errorMessage);
    console.log(errorMessage);
  }
}

//TransactionDiscount
function calculateTransactionDiscount(cleanedData, totalAmount) {
  const discountAmount = cleanedData.discountTransactionAmount || 0;

  return cleanedData.discountTransactionType === 'Currency'
    ? discountAmount
    : (totalAmount * discountAmount) / 100;
}

//Final Item Amount check
const validateAmount = (calculatedValue, cleanedValue, label, errors) => {
  const isCorrect = calculatedValue === parseFloat(cleanedValue);
  if (!isCorrect) {
    const errorMessage = `${label} is incorrect: ${cleanedValue}`;
    errors.push(errorMessage);
    console.log(errorMessage);
  }
};

//Other Expense
const otherExpense = ( totalAmount, cleanedData ) => {
  if (cleanedData.otherExpenseAmount) {
    const parsedAmount = parseFloat(cleanedData.otherExpenseAmount);
    totalAmount += parsedAmount;
    console.log(`Other Expense: ${cleanedData.otherExpenseAmount}`);
  }
  if (cleanedData.freightAmount) {
    const parsedAmount = parseFloat(cleanedData.freightAmount);
    totalAmount += parsedAmount;
    console.log(`Freight Amount: ${cleanedData.freightAmount}`);
  }
  if (cleanedData.roundOffAmount) {
    const parsedAmount = parseFloat(cleanedData.roundOffAmount);
    totalAmount -= parsedAmount;
    console.log(`Round Off Amount: ${cleanedData.roundOffAmount}`);
  }
  return totalAmount;  
};






exports.dataExist = {
  dataExist,
  newDataExists,
  salesDataExist
};
exports.salesOrder = {
  salesPrefix, 
  createNewOrder, 
};
exports.validation = {
  validateOrganizationTaxCurrency, 
  validateInputs
};
exports.calculation = { 
  taxType,
  calculateSalesOrder
};
