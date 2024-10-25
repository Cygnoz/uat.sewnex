// v1.0

const Organization = require("../database/model/organization");
const Item = require("../database/model/item");
const Account = require("../database/model/account");
const Customer = require("../database/model/customer");
const moment = require("moment-timezone");
const Settings = require("../database/model/settings")
const Order = require("../database/model/salesOrder")
const ItemTrack = require("../database/model/itemTrack")
const mongoose = require('mongoose');


// Fetch existing data
const dataExist = async ( organizationId, items, customerId, customerName ) => {
  const itemIds = items.map(item => item.itemId);
  
    const [organizationExists, customerExist , settings, itemTable, itemTrack ] = await Promise.all([
      Organization.findOne({ organizationId }, { organizationId: 1, organizationCountry: 1, state: 1 }),
      Customer.findOne({ organizationId , _id:customerId, customerDisplayName: customerName}, { _id: 1, customerDisplayName: 1, taxType: 1 }),
      Settings.findOne({ organizationId }),
      Item.find({ organizationId, _id: { $in: itemIds } }, { _id: 1, itemName: 1, taxPreference: 1, sellingPrice: 1, taxRate: 1, cgst: 1, sgst: 1, igst: 1, vat: 1 }),
      ItemTrack.find({ itemId: { $in: itemIds } })
    ]);
    return { organizationExists, customerExist , settings, itemTable, itemTrack };
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


      if (!mongoose.Types.ObjectId.isValid(customerId) || customerId.length !== 24) {
        return res.status(400).json({ message: `Invalid customer ID: ${customerId}` });
      }
      // Validate itemIds
      const invalidItemIds = itemIds.filter(itemId => !mongoose.Types.ObjectId.isValid(itemId) || itemId.length !== 24);
      if (invalidItemIds.length > 0) {
        return res.status(400).json({ message: `Invalid Item IDs: ${invalidItemIds.join(', ')}` });
      }
   
  
      const { organizationExists, customerExist , settings, itemTable, itemTrack } = await dataExist( organizationId, items, customerId, customerName );
      console.log( "Items", itemTable, itemTrack );
      //itemTable = cleanCustomerData(itemTable);
      //itemTrack = cleanCustomerData(itemTrack);
      //console.log( "Items", itemTrack );


      
      
      //Data Exist Validation
      if (!validateOrganizationTaxCurrency( organizationExists, customerExist, res )) return;
      
      // Verify itemTable fields with Item schema
      // if (!validateItemTable(items, itemTable, res)) return;
  
      //Date & Time
      const openingDate = generateOpeningDate(organizationExists);

      //Validate Inputs  
      if (!validateInputs( cleanedData, customerExist, items, itemTable, organizationExists, res)) return;

      const savedOrder = await createNewOrder(cleanedData, openingDate, organizationId, userId, userName );
        
      res.status(201).json({ message: "Sale Order created successfully" });
    } catch (error) {
      console.error("Error Creating Sales Order:", error);
      res.status(500).json({ message: "Internal server error." });
    }
  };













// Utility Functions
const validSalutations = ["Mr.", "Mrs.", "Ms.", "Miss.", "Dr."];
const validCustomerTypes = ["Individual", "Business"];
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
const validGSTTreatments = [
    "Registered Business - Regular",
    "Registered Business - Composition",
    "Unregistered Business",
    "Consumer",
    "Overseas",
    "Special Economic Zone",
    "Deemed Export",
    "Tax Deductor",
    "SEZ Developer",
];
  
  
//Clean Data 
function cleanCustomerData(data) {
    const cleanData = (value) => (value === null || value === undefined || value === "" || value === 0 ? undefined : value);
    return Object.keys(data).reduce((acc, key) => {
      acc[key] = cleanData(data[key]);
      return acc;
    }, {});
}
  
// Validate Organization Tax Currency
function validateOrganizationTaxCurrency( organizationExists, customerExist, res ) {
    if (!organizationExists) {
      res.status(404).json({ message: "Organization not found" });
      return false;
    }
    if (!customerExist) {
      res.status(404).json({ message: "Customer not found" });
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

// Create New Customer
function createNewOrder( data, openingDate, organizationId, userId, userName ) {
    const newOrder = new Order({ ...data, organizationId, status: "Active", createdDate: openingDate, userId, userName });
    return newOrder.save();
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

    //Basic Info
    validateItemTable(items, itemTable, errors);
    //validateSalutation(data.salutation, errors);
    //validateNames(['firstName', 'lastName'], data, errors);
    //validateEmail(data.customerEmail, errors);
    //validatePhones(['workPhone', 'mobile', 'cardNumber'], data, errors);

    //OtherDetails
    //validateAlphanumericFields(['pan'], data, errors);
    //validateIntegerFields(['creditDays', 'creditLimits', 'interestPercentage'], data, errors);
    //validateFloatFields(['debitOpeningBalance', 'creditOpeningBalance'], data, errors);
    //validateAlphabetsFields(['department', 'designation'], data, errors);

    //Tax Details
    //validateTaxType(data.taxType, validTaxTypes, errors);
    validatePlaceOfSupply(data.placeOfSupply, organizationExists, errors);
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
// Function to Validate Item Table 
function validateItemTable(items, itemTable, errors) {
  // Use validateField to check for mismatch in item count
  validateField( items.length !== itemTable.length,
    "Mismatch in item count between request and database.",
    errors
  );
}


// Validate Place Of Supply
function validatePlaceOfSupply(placeOfSupply, organization, errors) {
    validateField(
      placeOfSupply && !validCountries[organization.organizationCountry]?.includes(placeOfSupply),
      "Invalid Place of Supply: " + placeOfSupply,
      errors
    );
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