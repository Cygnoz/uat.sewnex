const Organization = require("../database/model/organization");
const Supplier = require('../database/model/supplier');
const PurchasePayment = require('../database/model/paymentMade');
const PurchaseBill = require('../database/model/bills')
const mongoose = require('mongoose');
const moment = require("moment-timezone");
const Prefix = require("../database/model/prefix");

// Fetch existing data
const dataExist = async (organizationId, unpaidBills ,supplierId, supplierDisplayName) => {
  const billIds = unpaidBills.map(unpaidBill => unpaidBill.billId);
  
  const [organizationExists, supplierExists , paymentTable, unpaidBillsExists ] = await Promise.all([
    Organization.findOne({ organizationId }, { organizationId: 1, organizationCountry: 1, state: 1 }),
    Supplier.findOne({ organizationId, _id: supplierId, supplierDisplayName  }, { _id: 1, supplierDisplayName: 1 }),
    PurchaseBill.findOne({ organizationId , _id : { $in: billIds}},{ _id: 1, billNumber: 1 , billDate: 1 , dueDate:1 , grandTotal: 1 , }),
    Prefix.findOne({ organizationId })

  ]);
  
  return { organizationExists, supplierExists, unpaidBillsExists , paymentTable };
};

// Add Purchase Payment
exports.addPayment = async (req, res) => {
    try {
      const { organizationId , id:userId , userName} = req.user; // Assuming user contains organization info
      const cleanedData = cleanSupplierData(req.body); // Cleaning data based on your custom method
      
      const { unpaidBills } = cleanedData;
      const { supplierId, supplierDisplayName } = cleanedData;
      const billIds = unpaidBills.map(unpaidBill => unpaidBill.billId);
      
      // Check for duplicate billIds
      const uniquebillIds = new Set(billIds);
      if (uniquebillIds.size !== billIds.length) {
        return res.status(400).json({ message: "Duplicate bill found" });
      }

      // Validate SupplierId
      if (!mongoose.Types.ObjectId.isValid(supplierId) || supplierId.length !== 24) {
        return res.status(400).json({ message: `Invalid supplier ID: ${supplierId}` });
      }
  
      // Validate PaymentId (assuming paymentId is part of cleanedData)
      const invalidBillIds = billIds.filter(billId => !mongoose.Types.ObjectId.isValid(billId) || billId.length !== 24);
      if (invalidBillIds.length > 0) {
        return res.status(400).json({ message: `Invalid bill IDs: ${invalidBillIds.join(', ')}` });
      }
      
      const { organizationExists, supplierExists , paymentTable } = await dataExist( organizationId, unpaidBills, supplierId , supplierDisplayName  );


      // Inside your addPayment or any other method
    if (!validateSupplierAndOrganization(organizationExists, supplierExists, res)) {
    return; // Stops execution if validation fails
    }

    //date & time
    const openingDate = generateOpeningDate(organizationExists);

    if (!validateInputs( cleanedData, supplierExists, unpaidBills , paymentTable, organizationExists, res)) return;

    

    const savedPayment = await createNewPayment(cleanedData, openingDate, organizationId, userId , userName );


      // Response
      return res.status(200).json({ message: 'Payment added successfully', savedPayment });
  
    } catch (error) {
      console.error('Error adding payment:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  };






  //Clean Data 
function cleanSupplierData(data) {
    const cleanData = (value) => (value === null || value === undefined || value === "" || value === 0 ? undefined : value);
    return Object.keys(data).reduce((acc, key) => {
      acc[key] = cleanData(data[key]);
      return acc;
    }, {});
}







  // Validate Supplier and Organization
function validateSupplierAndOrganization(organizationExists, supplierExists, unpaidBillsExists , res) {
    if (!organizationExists) {
        res.status(404).json({ message: "Organization not found" });
        return false;
    }
    if (!supplierExists) {
        res.status(404).json({ message: "Supplier not found" });
        return false;
    }
    if (!unpaidBillsExists) {
      res.status(404).json({ message: "unPaidBill not found" });
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
function validateInputs( data, supplierExists, unpaidBills , billExists, organizationExists, res) {
  const validationErrors = validatePaymentData(data, supplierExists, unpaidBills, billExists, organizationExists);

  if (validationErrors.length > 0) {
    res.status(400).json({ message: validationErrors.join(", ") });
    return false;
  }
  return true;
}

// Create New payment
function createNewPayment( data, openingDate, organizationId, userId, userName ) {
  const newPayment = new PurchasePayment({ ...data, organizationId, createdDate: openingDate, userId, userName });
  return newPayment.save();
}


//Validate Data
function validatePaymentData( data, supplierExists, unpaidBills, itemTable, organizationExists ) {
  const errors = [];

  console.log("bills Request :",unpaidBills);
  console.log("bills Fetched :",paymentTable);
  

  //Basic Info
  validateReqFields( data, errors );
  validatePaymentTable(items, itemTable, errors);


  validateFloatFields([ 'paymentMade','amountPaid','amountUsedForPayments','amountRefunded','amountInExcess'], data, errors);


  //Currency
    //validateCurrency(data.currency, validCurrencies, errors);

  return errors;
}


// Field validation utility
function validateField(condition, errorMsg, errors) {
    if (condition) errors.push(errorMsg);
}

//Valid Req Fields
function validateReqFields( data, errors ) {
  validateField( typeof data.supplierId === 'undefined' || typeof data.supplierDisplayName === 'undefined', "Please select a supplier", errors  );
  validateField( typeof data.unpaidBills === 'undefined', "Select an Bill", errors  );
}


// Function to Validate Item Table 
function validatePaymentTable(unpaidBills, paymentTable, errors) {
  // Check for bill count mismatch
  validateField( unpaidBills.length !== paymentTable.length, "Mismatch in bills count between request and database.", errors  );

  // Iterate through each bills to validate individual fields
  unpaidBills.forEach((unpaidBill) => {
    const fetchedBills = paymentTable.find(it => it._id.toString() === unpaidBill.billId);

    // Check if item exists in the item table
    validateField( !fetchedBills, `Bill with ID ${unpaidBill.billId} was not found.`, errors );
    if (!fetchedBills) return; 

     // Validate bill number
     validateField( unpaidBill.billNumber !== fetchedBills.billDate, `Bill Number Mismatch : ${unpaidBill.billNumber}`, errors );

    // Validate bill date
    validateField( unpaidBill.billDate !== fetchedBills.billDate, `Bill Date Mismatch : ${unpaidBill.billNumber} : ${unpaidBill.billDate}` , errors );

    // Validate duedate
    validateField( unpaidBill.dueDate !== fetchedBills.dueDate, `Due Date Mismatch for ${unpaidBill.billNumber}:  ${unpaidBill.dueDate}`, errors );

    // Validate billamount
    validateField( unpaidBill.billAmount !== fetchedBills.grandTotal, `Grand Total for ${unpaidBill.billNumber}: ${unpaidBill.billAmount}`, errors );


  // Validate float fields
  validateFloatFields(['amountDue', 'billAmount', 'payment'], unpaidBill, errors);
  });
}




//Valid Float Fields  
function validateFloatFields(fields, data, errors) {
  fields.forEach((balance) => {
    validateField(data[balance] && !isFloat(data[balance]),
      "Invalid " + balance.replace(/([A-Z])/g, " $1") + ": " + data[balance], errors);
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




