// v1.0

const Organization = require("../database/model/organization");
const Item = require("../database/model/item");
const Customer = require("../database/model/customer");
const moment = require("moment-timezone");
const Settings = require("../database/model/settings")
const Invoice = require("../database/model/salesInvoice")
const ItemTrack = require("../database/model/itemTrack")
const Prefix = require("../database/model/prefix");
const mongoose = require('mongoose');
const SalesOrder = require("../database/model/salesOrder");
const DefAcc  = require("../database/model/defaultAccount");
const TrialBalance = require("../database/model/trialBalance");
const Account = require("../database/model/account");


// Fetch existing data
const dataExist = async ( organizationId, customerId, customerName ) => {
    const [organizationExists, customerExist , settings, existingPrefix, defaultAccount, customerAccount ] = await Promise.all([
      Organization.findOne({ organizationId }, { organizationId: 1, organizationCountry: 1, state: 1 }),
      Customer.findOne({ organizationId , _id:customerId, customerDisplayName: customerName}, { _id: 1, customerDisplayName: 1, taxType: 1 }),
      Settings.findOne({ organizationId },{ salesOrderAddress: 1, salesOrderCustomerNote: 1, salesOrderTermsCondition: 1, salesOrderClose: 1, restrictSalesOrderClose: 1, termCondition: 1 ,customerNote: 1 }),
      Prefix.findOne({ organizationId }),
      DefAcc.findOne({ organizationId },{ salesAccount: 1, salesDiscountAccount: 1, outputCgst: 1, outputSgst: 1, outputIgst: 1 ,outputVat: 1 }),
      Account.findOne({ organizationId , accountName:customerName },{ _id:1, accountName:1 })
    ]);
    return { organizationExists, customerExist , settings, existingPrefix, defaultAccount, customerAccount };
};


//Fetch Item Data
const newDataExists = async (organizationId,items) => {
                // Retrieve items with specified fields
                const itemIds = items.map(item => item.itemId);

                const [newItems] = await Promise.all([
                  Item.find({ organizationId, _id: { $in: itemIds } }, { _id: 1, itemName: 1, taxPreference: 1, sellingPrice: 1, costPrice:1,  taxRate: 1, cgst: 1, sgst: 1, igst: 1, vat: 1 }),
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
                  // lastEntry: itemTrackMap[item._id] || null, // Attach lastEntry if found
                  currentStock: itemTrackMap[item._id.toString()] ? itemTrackMap[item._id.toString()].currentStock : null
                }));

                return { itemTable };
};


// Fetch Acc existing data
const accDataExists = async ( defaultAccount, organizationId, otherExpenseAccountId, freightAccountId, depositAccountId ) => {
  const [ salesAccountName, salesDiscountAccountName , outputCgstName, outputSgstName, outputIgstName, outputVatName, otherExpenseAcc, freightAcc, depositAcc ] = await Promise.all([
    Account.findOne({ organizationId , _id: defaultAccount.salesAccount }, { accountName: 1 }),
    Account.findOne({ organizationId , _id: defaultAccount.salesDiscountAccount}, { accountName: 1 }),

    Account.findOne({ organizationId , _id: defaultAccount.outputCgst}, { accountName: 1 }),
    Account.findOne({ organizationId , _id: defaultAccount.outputSgst}, { accountName: 1 }),
    Account.findOne({ organizationId , _id: defaultAccount.outputIgst}, { accountName: 1 }),

    Account.findOne({ organizationId , _id: defaultAccount.outputVat}, { accountName: 1 }),

    Account.findOne({ organizationId , _id: otherExpenseAccountId, accountHead: "Expenses" }, { _id:1, accountName: 1 }),
    Account.findOne({ organizationId , _id: freightAccountId, accountHead: "Expenses" }, { _id:1, accountName: 1 }),

    Account.findOne({ organizationId , _id: depositAccountId, accountHead: "Asset" }, { _id:1, accountName: 1 }),

  ]);
  return { salesAccountName, salesDiscountAccountName , outputCgstName, outputSgstName, outputIgstName, outputVatName, otherExpenseAcc, freightAcc, depositAcc };
};


//Get one and All
const salesDataExist = async ( organizationId, invoiceId ) => {    
    
  const [organizationExists, allinvoice, invoice ] = await Promise.all([
    Organization.findOne({ organizationId }, { organizationId: 1}),
    Invoice.find({ organizationId }),
    Invoice.findOne({ organizationId , _id: invoiceId },)
  ]);
  return { organizationExists, allinvoice, invoice };
};



// Add Sales Order
exports.addInvoice = async (req, res) => {
    console.log("Add Sales Invoice :", req.body);
    try {
      const { organizationId, id: userId, userName } = req.user;

      //Clean Data
      const cleanedData = cleanCustomerData(req.body);

      const { items, salesOrderId } = cleanedData;
      const { customerId, customerName, otherExpenseAccountId, freightAccountId, depositAccountId } = cleanedData;
      const itemIds = items.map(item => item.itemId);

      // Check for duplicate itemIds
      const uniqueItemIds = new Set(itemIds);
      if (uniqueItemIds.size !== itemIds.length) {
        return res.status(400).json({ message: "Duplicate Item found" });
      }


      //Validate Account Id
      if (!mongoose.Types.ObjectId.isValid(customerId) || customerId.length !== 24) {
        return res.status(400).json({ message: `Select a customer` });
      }      

      // if ((!mongoose.Types.ObjectId.isValid(otherExpenseAccountId) || otherExpenseAccountId.length !== 24) && cleanedData.otherExpenseAmount !== undefined ) {
      //   return res.status(400).json({ message: `Select other expense account` });
      // }

      if ((!mongoose.Types.ObjectId.isValid(freightAccountId) || freightAccountId.length !== 24) && cleanedData.freightAmount !== undefined ) {
        return res.status(400).json({ message: `Select freight account` });
      }

      if ((!mongoose.Types.ObjectId.isValid(depositAccountId) || depositAccountId.length !== 24) && cleanedData.paidAmount !== undefined ) {
        return res.status(400).json({ message: `Select deposit account` });
      }

      // Validate ItemIds
      const invalidItemIds = itemIds.filter(itemId => !mongoose.Types.ObjectId.isValid(itemId) || itemId.length !== 24);
      if (invalidItemIds.length > 0) {
        return res.status(400).json({ message: `Invalid item IDs: ${invalidItemIds.join(', ')}` });
      }   
  
      const { organizationExists, customerExist , settings, existingPrefix, defaultAccount, customerAccount } = await dataExist( organizationId, customerId, customerName );   
      
      const { itemTable } = await newDataExists( organizationId, items );

      //Data Exist Validation
      if (!validateOrganizationTaxCurrency( organizationExists, customerExist, existingPrefix, defaultAccount, res )) return;
      
      //Date & Time
      const openingDate = generateOpeningDate(organizationExists);

      //Validate Inputs  
      if (!validateInputs( cleanedData, customerExist, items, itemTable, organizationExists, defaultAccount, res)) return;

      //Tax Type
      taxtype(cleanedData, customerExist,organizationExists );

      //Default Account
      const { defAcc, error } = await defaultAccounting( cleanedData, defaultAccount, organizationExists );
      if (error) { 
        res.status(400).json({ message: error }); 
        return false; 
      }

      // Calculate Sales 
      if (!calculateSalesOrder( cleanedData, res )) return;      

      //Prefix
      await salesPrefix(cleanedData, existingPrefix );
      
      if(cleanedData._id){
        cleanedData._id = undefined;
      }
      const savedInvoice = await createNewInvoice(cleanedData, openingDate, organizationId, userId, userName );

      //Jornal
      await journal( savedInvoice, defAcc, customerAccount );

      //Item Track
      await itemTrack( savedInvoice, itemTable );

      // Delete the associated sale order if salesOrderId is provided
      if (salesOrderId) {
        await deleteSaleOrder(salesOrderId, organizationId, res);
      }

        
      res.status(201).json({ message: "Sale Invoice created successfully" });
      // console.log( "Sale Invoice created successfully:", savedInvoice );
    } catch (error) {
      console.error("Error Creating Sales Invoice:", error);
      res.status(500).json({ message: "Internal server error." });
    }
  };




// Get Last Invoice Prefix
exports.getLastInvoicePrefix = async (req, res) => {
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
      const lastPrefix = series.invoice + series.invoiceNum;

      res.status(200).json(lastPrefix);
  } catch (error) {
      console.error("Error fetching accounts:", error);
      res.status(500).json({ message: "Internal server error." });
  }
};



// Get Invoice Journal
exports.invoiceJournal = async (req, res) => {
  try {
      const organizationId = req.user.organizationId;
      const { invoiceId } = req.params;


      // Find all accounts where organizationId matches
      const invoiceJournal = await TrialBalance.find({ organizationId : organizationId, operationId : invoiceId });

      if (!invoiceJournal) {
          return res.status(404).json({
              message: "No Journal found for the Invoice.",
          });
      }
      
      res.status(200).json(invoiceJournal);
  } catch (error) {
      console.error("Error fetching journal:", error);
      res.status(500).json({ message: "Internal server error." });
  }
};


// Get All Sales allinvoice
exports.getAllSalesInvoice = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const { organizationExists, allinvoice } = await salesDataExist(organizationId);

    if (!organizationExists) {
      return res.status(404).json({
        message: "Organization not found",
      });
    }

    if (!allinvoice.length) {
      return res.status(404).json({
        message: "No Invoice found",
      });
    }

   // Get current date for comparison
   const currentDate = new Date();

   // Array to store purchase bills with updated status
   const updatedInvoices = [];

   // Map through purchase bills and update paidStatus if needed
   for (const invoice of allinvoice) {
   const { organizationId, balanceAmount, dueDate, paidStatus: currentStatus, ...rest } = invoice.toObject();
   
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
       await Invoice.updateOne({ _id: invoice._id }, { paidStatus: newStatus });
   }

   // Push the bill object with the updated status to the result array
   updatedInvoices.push({ ...rest, balanceAmount , dueDate , paidStatus: newStatus });
   }

    res.status(200).json({updatedInvoices});
  } catch (error) {
    console.error("Error fetching Invoice:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};



// Get One Sales Order
exports.getOneSalesInvoice = async (req, res) => {
try {
  const organizationId = req.user.organizationId;
  const invoiceId = req.params.invoiceId;

  const { organizationExists, invoice } = await salesDataExist( organizationId, invoiceId );

  if (!organizationExists) {
    return res.status(404).json({
      message: "Organization not found",
    });
  }

  if (!invoice) {
    return res.status(404).json({
      message: "No Invoice found",
    });
  }

  res.status(200).json(invoice);
} catch (error) {
  console.error("Error fetching Invoice:", error);
  res.status(500).json({ message: "Internal server error." });
}
};



// Delete Sales Order
async function deleteSaleOrder(salesOrderId, organizationId, res) {
  try {
    const deletedOrder = await SalesOrder.findOneAndDelete({ _id: salesOrderId, organizationId });
    if (!deletedOrder) {
      console.warn(`Sale Order with ID: ${salesOrderId} not found for Organization: ${organizationId}`);
    }
    return deletedOrder;      
  } catch (error) {
    console.error(`Error deleting Sale Order: ${error}`);
    res.status(500).json({ message: "Error deleting the Sale Order." });
    return null;
  }
}







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

  
//Clean Data 
function cleanCustomerData(data) {
  const cleanData = (value) => (value === null || value === undefined || value === "" ? undefined : value);
  return Object.keys(data).reduce((acc, key) => {
    acc[key] = cleanData(data[key]);
    return acc;
  }, {});
}

// Validate Organization Tax Currency
function validateOrganizationTaxCurrency( organizationExists, customerExist, existingPrefix, defaultAccount, res ) {
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
  if (!defaultAccount) {
    res.status(404).json({ message: "Setup Accounts in settings" });
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
function validateInputs( data, customerExist, items, itemExists, organizationExists, defaultAccount, res) {
  const validationErrors = validateQuoteData(data, customerExist, items, itemExists, organizationExists, defaultAccount );

  if (validationErrors.length > 0) {
    res.status(400).json({ message: validationErrors.join(", ") });
    return false;
  }
  return true;
}

// Create New Invoice
function createNewInvoice( data, openingDate, organizationId, userId, userName ) {
    const newInvoice = new Invoice({ ...data, organizationId, status :"Sent", createdDate: openingDate, userId, userName });
    return newInvoice.save();
}
  

// Sales Prefix
function salesPrefix( cleanData, existingPrefix ) {
  const activeSeries = existingPrefix.series.find(series => series.status === true);
  if (!activeSeries) {
      return res.status(404).json({ message: "No active series found for the organization." });
  }
  cleanData.salesInvoice = `${activeSeries.invoice}${activeSeries.invoiceNum}`;

  activeSeries.invoiceNum += 1;

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

//Default Account
async function defaultAccounting( data, defaultAccount, organizationExists ) {

  // Fetch data from accDataExists and destructure results
  const {
    salesAccountName,
    salesDiscountAccountName,
    outputCgstName,
    outputSgstName,
    outputIgstName,
    outputVatName,
    otherExpenseAcc,
    freightAcc,
    depositAcc
  } = await accDataExists(
    defaultAccount,
    organizationExists.organizationId,
    data.otherExpenseAccountId,
    data.freightAccountId,
    data.depositAccountId
  );
  
  
  let errorMessage = '';
  if (!defaultAccount.salesAccount && typeof data.totalAmount !== 'undefined') errorMessage += "Sales Account not found. ";
  if (!defaultAccount.salesDiscountAccount && (typeof data.totalDiscount !== 'undefined' || data.totalDiscount !== 0 )) errorMessage += "Discount Account not found. ";
 
  if (!defaultAccount.outputCgst && typeof data.cgst !== 'undefined') errorMessage += "CGST Account not found. ";
  if (!defaultAccount.outputSgst && typeof data.sgst !== 'undefined') errorMessage += "SGST Account not found. ";
  if (!defaultAccount.outputIgst && typeof data.igst !== 'undefined') errorMessage += "IGST Account not found. ";
  if (!defaultAccount.outputVat && typeof data.vat !== 'undefined') errorMessage += "VAT Account not found. ";
   
  if (!otherExpenseAcc && typeof data.otherExpenseAmount !== 'undefined') errorMessage += "Other Expense Account not found. ";
  if (!freightAcc && typeof data.freightAmount !== 'undefined') errorMessage += "Freight Account not found. ";
  if (!depositAcc && typeof data.paidAmount !== 'undefined') errorMessage += "Deposit Account not found. ";


  // If there is an error message, return it as a response
  if (errorMessage) {
    return { defAcc: null, error: errorMessage.trim() }; // Return error message
  }
  
  // Update defaultAccount fields
  defaultAccount.salesAccountName = salesAccountName?.accountName;
  defaultAccount.salesDiscountAccountName = salesDiscountAccountName?.accountName;

  if (data.taxtype !== 'VAT') {
    defaultAccount.outputCgstName = outputCgstName?.accountName;
    defaultAccount.outputSgstName = outputSgstName?.accountName;
    defaultAccount.outputIgstName = outputIgstName?.accountName;
  } else {
    defaultAccount.outputVatName = outputVatName?.accountName;
  }
  if(data.otherExpenseAmount !=='undefined'){
    defaultAccount.otherExpenseAccountName = otherExpenseAcc?.accountName;
    defaultAccount.otherExpenseAccountId = otherExpenseAcc?._id;
  }
  if(data.freightAmount !=='undefined'){
    defaultAccount.freightAccountName = freightAcc?.accountName;
    defaultAccount.freightAccountId = freightAcc?._id;
  }
  if(data.paidAmount !=='undefined'){
    defaultAccount.depositAccountName = depositAcc?.accountName;
    defaultAccount.depositAccountId = depositAcc?._id;
  }    
  return { defAcc:defaultAccount ,error:null };
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
function validateQuoteData( data, customerExist, items, itemTable, organizationExists, defaultAccount ) {
  const errors = [];

  // console.log("Item Request :",items);
  // console.log("Item Fetched :",itemTable);
  

  //Basic Info
  validateReqFields( data, customerExist, defaultAccount, errors );
  validateItemTable(items, itemTable, errors);
  validateDiscountTransactionType(data.discountTransactionType, errors);
  validateShipmentPreference(data.shipmentPreference, errors);
  validatePaymentMode(data.paymentMode, errors);




  //OtherDetails
  //validateAlphanumericFields([''], data, errors);
  validateIntegerFields(['totalItem'], data, errors);
  validateFloatFields(['discountTransactionAmount', 'subTotal','cgst','sgst','igst','vat','totalTax','totalAmount','totalDiscount','otherExpenseAmount','freightAmount','roundOffAmount','paidAmount'], data, errors);
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
function validateReqFields( data, customerExist, defaultAccount, errors ) {

validateField( typeof data.customerId === 'undefined' || typeof data.customerName === 'undefined', "Please select a Customer", errors  );
validateField( typeof data.placeOfSupply === 'undefined', "Place of supply required", errors  );

validateField( typeof data.items === 'undefined', "Select an item", errors  );

validateField( typeof data.otherExpenseAmount !== 'undefined' && typeof data.otherExpenseReason === 'undefined', "Please enter other expense reason", errors  );

validateField( typeof data.otherExpenseAmount !== 'undefined' && typeof data.otherExpenseAccountId === 'undefined', "Please select expense account", errors  );
validateField( typeof data.freightAmount !== 'undefined' && typeof data.freightAccountId === 'undefined', "Please select freight account", errors  );

validateField( typeof data.roundOffAmount !== 'undefined' && !(data.roundOffAmount >= 0 && data.roundOffAmount <= 1), "Round Off Amount must be between 0 and 1", errors );

validateField( typeof data.paidAmount !== 'undefined' && !(data.paidAmount <= data.totalAmount), "Excess payment amount", errors );
validateField( typeof data.paidAmount !== 'undefined' && !(data.paidAmount >= 0 ), "Negative payment amount", errors );

validateField( typeof defaultAccount.salesAccount === 'undefined', "No Sales Account found", errors  );
validateField( typeof defaultAccount.salesDiscountAccount === 'undefined', "No Sales Discount Account found", errors  );

validateField( customerExist.taxType === 'GST' && typeof defaultAccount.outputCgst === 'undefined', "No Output Cgst Account found", errors  );
validateField( customerExist.taxType === 'GST' && typeof defaultAccount.outputSgst === 'undefined', "No Output Sgst Account found", errors  );
validateField( customerExist.taxType === 'GST' && typeof defaultAccount.outputIgst === 'undefined', "No Output Igst Account found", errors  );
validateField( customerExist.taxType === 'VAT' && typeof defaultAccount.outputVat === 'undefined', "No Output Vat Account found", errors  );

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

  // Validate Stock Count 
  validateField( item.quantity > fetchedItem.currentStock, `Insufficient Stock for ${item.itemName}: Requested quantity ${item.quantity}, Available stock ${fetchedItem.currentStock}`, errors );

  // Validate float fields
  validateFloatFields(['sellingPrice', 'itemTotaltax', 'discountAmount', 'itemAmount'], item, errors);
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
  let saleAmount =0;
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
    saleAmount +=(item.sellingPrice * item.quantity);
    

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
      checkAmount(calculatedTaxAmount, item.itemTotaltax, item.itemName, 'Total tax',errors);

      totalTax += calculatedCgstAmount + calculatedSgstAmount + calculatedIgstAmount + calculatedVatAmount || 0 ;


    } else {
      console.log(`Skipping Tax for Non-Taxable item: ${item.itemName}`);
      console.log(`Item: ${item.itemName}, Calculated Discount: ${totalDiscount}`);

    }

    // Update total values
    subTotal += parseFloat(itemTotal);

    checkAmount(itemTotal, item.itemAmount, item.itemName, 'Item Total',errors);

    console.log(`${item.itemName} Item Total: ${itemTotal} , Provided ${item.itemAmount}`);
    console.log(`${item.itemName} Total Tax: ${calculatedTaxAmount} , Provided ${item.itemTotaltax || 0 }`);
    console.log("");
  });
  
  //Sale amount
  cleanedData.saleAmount=saleAmount;

  console.log(`SubTotal: ${subTotal} , Provided ${cleanedData.subTotal}`);
  
  //Other Expense
  totalAmount = otherExpense( subTotal, cleanedData );  
  console.log("After Other Expense: ",totalAmount);  

  // Transaction Discount
  let transactionDiscount = calculateTransactionDiscount(cleanedData, totalAmount);

  totalDiscount +=  parseFloat(transactionDiscount); 

  // Total amount calculation
  totalAmount -= transactionDiscount;
  
  //Sale amount
  cleanedData.balanceAmount=totalAmount-(cleanedData.paidAmount || 0);

  
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

































































async function journal(savedInvoice, defAcc, customerAccount ) {  
  const discount = {
    organizationId: savedInvoice.organizationId,
    operationId: savedInvoice._id,
    transactionId: savedInvoice.salesInvoice,
    date: savedInvoice.createdDate,
    accountId: defAcc.salesDiscountAccount || undefined,
    accountName: defAcc.salesDiscountAccountName || undefined,
    action: "Sales Invoice",
    debitAmount: savedInvoice.totalDiscount,
    creditAmount: 0,
    remark: savedInvoice.note,
  };
  const sale = {
    organizationId: savedInvoice.organizationId,
    operationId: savedInvoice._id,
    transactionId: savedInvoice.salesInvoice,
    date: savedInvoice.createdDate,
    accountId: defAcc.salesAccount || undefined,
    accountName: defAcc.salesAccountName || undefined,
    action: "Sales Invoice",
    debitAmount: 0,
    creditAmount: savedInvoice.saleAmount,
    remark: savedInvoice.note,
  };
  const cgst = {
    organizationId: savedInvoice.organizationId,
    operationId: savedInvoice._id,
    transactionId: savedInvoice.salesInvoice,
    date: savedInvoice.createdDate,
    accountId: defAcc.outputCgst || undefined,
    accountName: defAcc.outputCgstName || undefined,
    action: "Sales Invoice",
    debitAmount: 0,
    creditAmount: savedInvoice.cgst,
    remark: savedInvoice.note,
  };
  const sgst = {
    organizationId: savedInvoice.organizationId,
    operationId: savedInvoice._id,
    transactionId: savedInvoice.salesInvoice,
    date: savedInvoice.createdDate,
    accountId: defAcc.outputSgst || undefined,
    accountName: defAcc.outputSgstName || undefined,
    action: "Sales Invoice",
    debitAmount: 0,
    creditAmount: savedInvoice.sgst,
    remark: savedInvoice.note,
  };
  const igst = {
    organizationId: savedInvoice.organizationId,
    operationId: savedInvoice._id,
    transactionId: savedInvoice.salesInvoice,
    date: savedInvoice.createdDate,
    accountId: defAcc.outputIgst || undefined,
    accountName: defAcc.outputIgstName || undefined,
    action: "Sales Invoice",
    debitAmount: 0,
    creditAmount: savedInvoice.igst,
    remark: savedInvoice.note,
  };
  const vat = {
    organizationId: savedInvoice.organizationId,
    operationId: savedInvoice._id,
    transactionId: savedInvoice.salesInvoice,
    date: savedInvoice.createdDate,
    accountId: defAcc.outputVat || undefined,
    accountName: defAcc.outputVatName || undefined,
    action: "Sales Invoice",
    debitAmount: 0,
    creditAmount: savedInvoice.vat,
    remark: savedInvoice.note,
  };
  const customer = {
    organizationId: savedInvoice.organizationId,
    operationId: savedInvoice._id,
    transactionId: savedInvoice.salesInvoice,
    date: savedInvoice.createdDate,
    accountId: customerAccount._id || undefined,
    accountName: customerAccount.accountName || undefined,
    action: "Sales Invoice",
    debitAmount: savedInvoice.totalAmount,
    creditAmount: 0,
    remark: savedInvoice.note,
  };
  const customerPaid = {
    organizationId: savedInvoice.organizationId,
    operationId: savedInvoice._id,
    transactionId: savedInvoice.salesInvoice,
    date: savedInvoice.createdDate,
    accountId: customerAccount._id || undefined,
    accountName: customerAccount.accountName || undefined,
    action: "Receipt",
    debitAmount: 0,
    creditAmount: savedInvoice.paidAmount,
    remark: savedInvoice.note,
  };
  const depositAccount = {
    organizationId: savedInvoice.organizationId,
    operationId: savedInvoice._id,
    transactionId: savedInvoice.salesInvoice,
    date: savedInvoice.createdDate,
    accountId: defAcc.depositAccountId || undefined,
    accountName: defAcc.depositAccountName || undefined,
    action: "Receipt",
    debitAmount: savedInvoice.paidAmount,
    creditAmount: 0,
    remark: savedInvoice.note,
  };
  const otherExpense = {
    organizationId: savedInvoice.organizationId,
    operationId: savedInvoice._id,
    transactionId: savedInvoice.salesInvoice,
    date: savedInvoice.createdDate,
    accountId: defAcc.otherExpenseAccountId || undefined,
    accountName: defAcc.otherExpenseAccountName || undefined,
    action: "Sales Invoice",
    debitAmount: 0,
    creditAmount: savedInvoice.otherExpenseAmount,
    remark: savedInvoice.note,
  };
  const freight = {
    organizationId: savedInvoice.organizationId,
    operationId: savedInvoice._id,
    transactionId: savedInvoice.salesInvoice,
    date: savedInvoice.createdDate,
    accountId: defAcc.freightAccountId || undefined,
    accountName: defAcc.freightAccountName || undefined,
    action: "Sales Invoice",
    debitAmount: 0,
    creditAmount: savedInvoice.freightAmount,
    remark: savedInvoice.note,
  };
  const roundOff = {
    organizationId: savedInvoice.organizationId,
    operationId: savedInvoice._id,
    transactionId: savedInvoice.salesInvoice,
    date: savedInvoice.createdDate,
    accountName: "Round Off",
    action: "Sales Invoice",
    debitAmount: savedInvoice.roundOffAmount,
    creditAmount: 0,
    remark: savedInvoice.note,
  };

  console.log("cgst", cgst.debitAmount,  cgst.creditAmount);
  console.log("sgst", sgst.debitAmount,  sgst.creditAmount);
  console.log("igst", igst.debitAmount,  igst.creditAmount);
  console.log("vat", vat.debitAmount,  vat.creditAmount);

  console.log("sale", sale.debitAmount,  sale.creditAmount);
  console.log("customer", customer.debitAmount,  customer.creditAmount);
  console.log("discount", discount.debitAmount,  discount.creditAmount);

  
  console.log("otherExpense", otherExpense.debitAmount,  otherExpense.creditAmount);
  console.log("freight", freight.debitAmount,  freight.creditAmount);
  console.log("roundOff", roundOff.debitAmount,  roundOff.creditAmount);

  console.log("customerPaid", customerPaid.debitAmount,  customerPaid.creditAmount);
  console.log("depositAccount", depositAccount.debitAmount,  depositAccount.creditAmount);

  const  debitAmount = cgst.debitAmount  + sgst.debitAmount + igst.debitAmount +  vat.debitAmount + sale.debitAmount + customer.debitAmount + discount.debitAmount + otherExpense.debitAmount + freight.debitAmount + roundOff.debitAmount + customerPaid.debitAmount + depositAccount.debitAmount ;
  const  creditAmount = cgst.creditAmount  + sgst.creditAmount + igst.creditAmount +  vat.creditAmount + sale.creditAmount + customer.creditAmount + discount.creditAmount + otherExpense.creditAmount + freight.creditAmount + roundOff.creditAmount + customerPaid.creditAmount + depositAccount.creditAmount ;

  console.log("Total Debit Amount: ", debitAmount );
  console.log("Total Credit Amount: ", creditAmount );

  // console.log( discount, sale, cgst, sgst, igst, vat, customer, otherExpense, freight, roundOff );


  createTrialEntry( sale )

  //Tax
  if(savedInvoice.cgst){
    createTrialEntry( cgst )
  }
  if(savedInvoice.sgst){
    createTrialEntry( sgst )
  }
  if(savedInvoice.igst){
    createTrialEntry( igst )
  }
  if(savedInvoice.vat){
    createTrialEntry( vat )
  }

  //Discount  
  if(savedInvoice.totalDiscount){
    createTrialEntry( discount )
  }

  //Other Expense
  if(savedInvoice.otherExpenseAmount){
    createTrialEntry( otherExpense )
  }

  //Freight
  if(savedInvoice.freightAmount){
    createTrialEntry( freight )
  }
  
  //Round Off
  if(savedInvoice.roundOffAmount){
    createTrialEntry( roundOff )
  }
 
  //Customer
  createTrialEntry( customer )
  
  //Paid
  if(savedInvoice.paidAmount){
    createTrialEntry( customerPaid )
    createTrialEntry( depositAccount )
  }
}




async function createTrialEntry( data ) {
  const newTrialEntry = new TrialBalance({
      organizationId:data.organizationId,
      operationId:data.operationId,
      transactionId: data.transactionId,
      date:data.date,
      accountId: data.accountId,
      accountName: data.accountName,
      action: data.action,
      debitAmount: data.debitAmount,
      creditAmount: data.creditAmount,
      remark: data.remark
});

await newTrialEntry.save();

}






















// Item Track Function
async function itemTrack(savedInvoice, itemTable) {
  const { items } = savedInvoice;

  for (const item of items) {
    // Find the matching item in itemTable by itemId
    const matchingItem = itemTable.find((entry) => entry._id.toString() === item.itemId);

    if (!matchingItem) {
      console.error(`Item with ID ${item.itemId} not found in itemTable`);
      continue; // Skip this entry if not found
    }

    // Calculate the new stock level after the sale
    const newStock = matchingItem.currentStock - item.quantity;
    if (newStock < 0) {
      console.error(`Insufficient stock for item ${item.itemName}`);
      continue; // Skip this entry if stock is insufficient
    }

    // Create a new entry for item tracking
    const newTrialEntry = new ItemTrack({
      organizationId: savedInvoice.organizationId,
      operationId: savedInvoice._id,
      transactionId: savedInvoice.salesInvoice,
      action: "Sale",
      date: savedInvoice.salesInvoiceDate,
      itemId: matchingItem._id,
      itemName: matchingItem.itemName,
      sellingPrice: matchingItem.sellingPrice,
      costPrice: matchingItem.costPrice || 0, // Assuming cost price is in itemTable
      creditQuantity: item.quantity, // Quantity sold
      currentStock: newStock,
      remark: `Sold to ${savedInvoice.customerName}`,
    });

    // Save the tracking entry and update the item's stock in the item table
    //await newTrialEntry.save();

    // console.log(newTrialEntry);
    
    

  }
}
