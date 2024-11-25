const Organization = require("../database/model/organization");
const Customer = require("../database/model/customer");
const Invoice = require("../database/model/salesInvoice")
const moment = require("moment-timezone");
const Prefix = require("../database/model/prefix");
const mongoose = require('mongoose');
const SalesReceipt = require('../database/model/salesReceipt')


// Fetch existing data
const dataExist = async (organizationId, invoice ,customerId, customerDisplayName) => {
    const invoiceIds = invoice.map(invoices => invoices.invoiceId);
    
    const [organizationExists, customerExists , paymentTable , existingPrefix ] = await Promise.all([
      Organization.findOne({ organizationId }, { organizationId: 1, organizationCountry: 1, state: 1 }),
      Customer.findOne({ organizationId, _id: customerId, customerDisplayName  }, { _id: 1, customerDisplayName: 1 }),
      Invoice.find({ organizationId , _id : { $in: invoiceIds}},{ _id: 1, salesInvoice: 1 , salesInvoiceDate: 1 , dueDate:1 , totalAmount: 1 , balanceAmount : 1}),
      Prefix.findOne({ organizationId })
  
    ]);
    
    return { organizationExists, customerExists, paymentTable , existingPrefix };
  };



  const paymentDataExist = async ( organizationId, PaymentId ) => {    
    
    const [organizationExists, allPayments, payments ] = await Promise.all([
      Organization.findOne({ organizationId }, { organizationId: 1}),
      SalesReceipt.find({ organizationId }),
      SalesReceipt.findOne({ organizationId , _id: PaymentId },)
    ]);
    return { organizationExists, allPayments, payments };
  };




  exports.addReceipt = async (req, res) => {
    try {
      const { organizationId, id: userId, userName } = req.user; // Assuming user contains organization info
      const cleanedData = cleanCustomerData(req.body);

      const { invoice, amountReceived } = cleanedData; // Extract paymentMade from cleanedData
      const { customerId, customerDisplayName } = cleanedData;
      const invoiceIds = invoice.map(invoices => invoices.invoiceId);
  

      // Check for duplicate billIds
    const uniqueInvoices = new Set(invoiceIds);
    if (uniqueInvoices.size !== invoiceIds.length) {
      return res.status(400).json({ message: "Duplicate invoice found" });
    }

    // Validate customerId
    if (!mongoose.Types.ObjectId.isValid(customerId) || customerId.length !== 24) {
      return res.status(400).json({ message: `Invalid Customer ID: ${customerId}` });
    }

    // Validate Bill IDs
    const invalidInvoices = invoiceIds.filter(invoiceId => !mongoose.Types.ObjectId.isValid(invoiceId) || invoiceId.length !== 24);
    if (invalidInvoices.length > 0) {
      return res.status(400).json({ message: `Invalid invoice IDs: ${invalidInvoices.join(', ')}` });
    }

    // Check if organization and customer exist
    const { organizationExists, customerExists, paymentTable, existingPrefix } = await dataExist(organizationId, invoice, customerId, customerDisplayName);

    // Validate customer and organization
    if (!validateCustomerAndOrganization(organizationExists, customerExists, existingPrefix, res)) {
      return; // Stops execution if validation fails
    }


    // Validate input values, unpaidBills, and paymentTable
    if (!validateInputs(cleanedData, customerExists, invoice, paymentTable, organizationExists, res)) {
      return; // Stops execution if validation fails
    }


    const updatedData = await calculateTotalPaymentMade(cleanedData, amountReceived );

  // Validate invoices
  const validatedInvoices = validateInvoices(updatedData.invoice);

  // Process invoices
  const paymentResults = await processInvoices(validatedInvoices);

  console.log('Invoice processing complete:', paymentResults);

    // Re-fetch the updated bills to get the latest `amountDue` and `balanceAmount`
    const updatedInvoice = await SalesReceipt.find({ _id: { $in: updatedData.invoice.map(receipt => receipt.invoiceId) } });


    const openingDate = generateOpeningDate({ timeZoneExp: organizationId.timeZoneExp, dateFormatExp: organizationId.dateFormatExp, dateSplit: organizationId.dateSplit });


    const payment = await createNewPayment(updatedData , openingDate, organizationId, userId, userName);


       //Response with the updated bills and the success message
       return res.status(200).json({
        message: 'Payment added successfully',  payment , updatedInvoice,
  
      });
      
} catch (error) {
  console.error('Error adding payment:', error);
  return res.status(500).json({ message: 'Internal server error' });
}
};






exports.getAllSalesReceipt = async (req, res) => {
  // const { organizationId } = req.body;
  try {

    const organizationId  = req.user.organizationId;

    // Check if an Organization already exists
    const { organizationExists , allPayments} = await paymentDataExist(organizationId);

    if (!organizationExists) {
      return res.status(404).json({
        message: "Organization not found",
      });
    }

    
    if (!allPayments.length) {
      return res.status(404).json({
        message: "No Payments found",
      });
    }
    res.status(200).json(allPayments);

  } catch (error) {
    console.error("Error fetching purchase paymentMade:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};



// Get One Payment Quote
exports.getSalesReceipt = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const  PaymentId = req.params.PaymentId;

    const { organizationExists , payments } = await paymentDataExist(organizationId , PaymentId);

    if (!organizationExists) {
      return res.status(404).json({
        message: "Organization not found",
      });
    }


    if (!payments) {
      return res.status(404).json({
        message: "No payment found",
      });
    }

    res.status(200).json(payments);
  } catch (error) {
    console.error("Error fetching Payments:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};







function cleanCustomerData(data) {
  const cleanData = (value) => (value === null || value === undefined || value === "" ? undefined : value);
  return Object.keys(data).reduce((acc, key) => {
    acc[key] = cleanData(data[key]);
    return acc;
  }, {});
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





 // Validate Supplier and Organization
 function validateCustomerAndOrganization(organizationExists, customerExists, existingPrefix ,res) {
  if (!organizationExists) {
      res.status(404).json({ message: "Organization not found" });
      return false;
  }
  if (!customerExists) {
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
function validateInputs( data, customerExists, invoice , organizationExists, paymentTableExist ,  res) {
  const validationErrors = validatePaymentData(data, customerExists, invoice, organizationExists , paymentTableExist);

  if (validationErrors.length > 0) {
    res.status(400).json({ message: validationErrors.join(", ") });
    return false;
  }
  return true;
}




// Function to create a new payment record
function createNewPayment(data, openingDate, organizationId, userId, userName) {
  const newPayment = new SalesReceipt({
    ...data,
    organizationId,
    createdDate: openingDate,
    userId,
    userName
  });
  return newPayment.save(); // Save the payment to the database
}




//Validate Data
function validatePaymentData( data, customerExists, invoice, paymentTable ) {
  const errors = [];

  console.log("invoice Request :",invoice);
  console.log("invoice Fetched :",paymentTable);
  

  //Basic Info
  validateReqFields( data, customerExists, errors );
  validatePaymentTable(invoice, paymentTable, errors);
  validateFloatFields([ 'amountReceived','amountUsedForPayments','total'], data, errors);


  //Currency
  // validateCurrency(data.currency, validCurrencies, errors);

  return errors;
}


// Field validation utility
function validateField(condition, errorMsg, errors) {
  if (condition) errors.push(errorMsg);
}

//Valid Req Fields
function validateReqFields( data, errors ) {
  validateField( typeof data.customerId === 'undefined' || typeof data.customerDisplayName === 'undefined', "Please select a customer", errors  );
  validateField( typeof data.invoice === 'undefined', "Select an invoice", errors  );
}


// Function to Validate Item Table 
function validatePaymentTable(invoice, paymentTable, errors) {
  console.log("validate:",invoice , paymentTable)
  // Check for bill count mismatch
  validateField( invoice.length !== paymentTable.length, "Mismatch in invoice count between request and database.", errors  );

  // Iterate through each bills to validate individual fields
  invoice.forEach((invoices) => {
    const fetchedInvoices = paymentTable.find(it => it._id.toString() === invoices.invoiceId);

    // Check if item exists in the item table
    validateField( !fetchedInvoices, `Invoice with ID ${invoices.invoiceId} was not found.`, errors );
    if (!fetchedInvoices) return; 

     // Validate bill number
     validateField( invoices.salesInvoice !== fetchedInvoices.salesInvoice, `Bill Number Mismatch Bill Number: ${invoices.salesInvoice}`, errors );

    // Validate bill date
    validateField( invoices.salesInvoiceDate !== fetchedInvoices.salesInvoiceDate, `Bill Date Mismatch Bill Number: ${invoices.salesInvoice} : ${invoices.salesInvoiceDate}` , errors );

    // Validate duedate
    validateField( invoices.dueDate !== fetchedInvoices.dueDate, `Due Date Mismatch for Bill Number${invoices.salesInvoice}:  ${invoices.dueDate}`, errors );

    // Validate billamount
    validateField( invoices.totalAmount !== fetchedInvoices.totalAmount, `Grand Total for Bill Number${invoices.salesInvoice}: ${invoices.totalAmount}`, errors );

    // Validate amountDue
    validateField( invoices.balanceAmount !== fetchedInvoices.balanceAmount, `Amount Due for bill number ${invoices.salesInvoice}: ${invoices.balanceAmount}`, errors );


  // Validate float fields
  validateFloatFields(['balanceAmount', 'totalAmount', 'paymentAmount'], invoices, errors);


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







const calculateAmountDue = async (invoiceId, { amount }) => {
  try {
    // Find the bill by its ID
    const receipt = await Invoice.findById(invoiceId);

    if (!receipt) {
      throw new Error(`Invoice not found with ID: ${invoiceId}`);
    }


    // Initialize fields if undefined
    receipt.paidAmount = typeof receipt.paidAmount === 'number' ? receipt.paidAmount : 0;
    receipt.balanceAmount = typeof receipt.balanceAmount === 'number' ? receipt.balanceAmount : receipt.totalAmount;

   
    // Calculate new paidAmount and balanceAmount
    receipt.paidAmount += amount;
    receipt.balanceAmount = receipt.totalAmount - receipt.paidAmount;

    // Ensure values are within correct bounds
    if (receipt.balanceAmount < 0) {
      receipt.balanceAmount = 0;
    }
    if (receipt.paidAmount > receipt.totalAmount) {
      receipt.paidAmount = receipt.totalAmount;
    }

    // Save the updated bill with new balanceAmount and paidAmount
    await receipt.save();

    // Log the updated bill status for debugging
    console.log(`Updated Invoice ID ${invoiceId}: Paid Amount: ${receipt.paidAmount}, Balance Amount: ${receipt.balanceAmount}`);

    // Check if payment is complete
    if (receipt.balanceAmount === 0) {
      return {
        message: `Payment completed for Invoice ID ${invoiceId}. No further payments are needed.`,
        receipt,
      };
    }

    return { message: 'Payment processed', receipt };

  } catch (error) {
    console.error(`Error calculating balance amount for Invoice ID ${invoiceId}:`, error);
    throw new Error(`Error calculating balance amount for Invoice ID ${invoiceId}: ${error.message}`);
  }
};



const calculateTotalPaymentMade = async (cleanedData) => {
  let totalPayment = 0;

  // Sum the `payment` amounts from each unpaid bill in the array
  for (const receipt of cleanedData.invoice) {
    totalPayment += receipt.paymentAmount || 0; // Ensure `payment` is a number and add it
  }

  // Assign the total to both `total` and `amountReceived` field in `cleanedData`
  cleanedData.total = totalPayment;
  cleanedData.amountReceived = totalPayment;

  // Calculate amountUsedForPayments and amountInExcess
  const amountReceived = cleanedData.amountReceived || 0;
  cleanedData.amountUsedForPayments = amountReceived - totalPayment;

  return cleanedData;
};


// Utility function to validate invoices
function validateInvoices(invoices) {
  return invoices.map(receipt => {
    if (typeof receipt.paymentAmount === 'undefined') {
      console.warn(`Payment field missing for Invoice ID: ${receipt.invoiceId}`);
      receipt.paymentAmount = 0; // Default paymentAmount to 0
    }
    return receipt;
  });
}

// Utility function to process invoices
async function processInvoices(invoices) {
  const results = [];
  for (const invoice of invoices) {
    try {
      const result = await calculateAmountDue(invoice.invoiceId, { amount: invoice.paymentAmount });
      results.push(result);
    } catch (error) {
      console.error(`Error processing Invoice ID: ${invoice.invoiceId}`, error);
      throw error; // Re-throw for higher-level error handling
    }
  }
  return results;
}


