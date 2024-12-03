const Organization = require("../database/model/organization");
const Supplier = require('../database/model/supplier');
const PurchasePayment = require('../database/model/paymentMade');
const PurchaseBill = require('../database/model/bills')
const mongoose = require('mongoose');
const moment = require("moment-timezone");
const Prefix = require("../database/model/prefix");``

// Fetch existing data
const dataExist = async (organizationId, unpaidBills ,supplierId, supplierDisplayName) => {
  const billIds = unpaidBills.map(unpaidBill => unpaidBill.billId);
  
  const [organizationExists, supplierExists , paymentTable , existingPrefix ] = await Promise.all([
    Organization.findOne({ organizationId }, { organizationId: 1, organizationCountry: 1, state: 1 }),
    Supplier.findOne({ organizationId, _id: supplierId, supplierDisplayName  }, { _id: 1, supplierDisplayName: 1 }),
    PurchaseBill.find({ organizationId , _id : { $in: billIds}},{ _id: 1, billNumber: 1 , billDate: 1 , dueDate:1 , grandTotal: 1 , balanceAmount : 1}),
    Prefix.findOne({ organizationId })

  ]);
  
  return { organizationExists, supplierExists, paymentTable , existingPrefix };
};




const paymentDataExist = async ( organizationId, PaymentId ) => {    
    
  const [organizationExists, allPayments, payments ] = await Promise.all([
    Organization.findOne({ organizationId }, { organizationId: 1}),
    PurchasePayment.find({ organizationId }),
    PurchasePayment.findOne({ organizationId , _id: PaymentId },)
  ]);
  return { organizationExists, allPayments, payments };
};



exports.addPayment = async (req, res) => {
  try {
    const { organizationId, id: userId, userName } = req.user; // Assuming user contains organization info
    const cleanedData = cleanSupplierData(req.body); // Cleaning data based on your custom method

    const { unpaidBills, paymentMade } = cleanedData; // Extract paymentMade from cleanedData
    const { supplierId, supplierDisplayName } = cleanedData;
    const billIds = unpaidBills.map(unpaidBill => unpaidBill.billId);

    // Check for duplicate billIds
    const uniqueBillIds = new Set(billIds);
    if (uniqueBillIds.size !== billIds.length) {
      return res.status(400).json({ message: "Duplicate bill found" });
    }

    // Validate SupplierId
    if (!mongoose.Types.ObjectId.isValid(supplierId) || supplierId.length !== 24) {
      return res.status(400).json({ message: `Invalid supplier ID: ${supplierId}` });
    }

    // Validate Bill IDs
    const invalidBillIds = billIds.filter(billId => !mongoose.Types.ObjectId.isValid(billId) || billId.length !== 24);
    if (invalidBillIds.length > 0) {
      return res.status(400).json({ message: `Invalid bill IDs: ${invalidBillIds.join(', ')}` });
    }

    // Check if organization and supplier exist
    const { organizationExists, supplierExists, paymentTable, existingPrefix } = await dataExist(organizationId, unpaidBills, supplierId, supplierDisplayName);
    
    // Validate supplier and organization
    if (!validateSupplierAndOrganization(organizationExists, supplierExists, existingPrefix, res)) {
      return; // Stops execution if validation fails
    }

    // Validate input values, unpaidBills, and paymentTable
    if (!validateInputs(cleanedData, supplierExists, unpaidBills, paymentTable, organizationExists, res)) {
      return; // Stops execution if validation fails
    }

    // Calculate the total payment made
    const updatedData = await calculateTotalPaymentMade(cleanedData, paymentMade );

    // Generate prefix for vendor payment
    await vendorPaymentPrefix(cleanedData, existingPrefix);

    // Log the payment made for tracking
  

    // Ensure 'payment' field is set for each bill, default to 0 if not defined
    updatedData.unpaidBills.forEach(bill => {
      if (typeof bill.payment === 'undefined') {
        console.warn(`Payment field missing for bill ID: ${bill.billId}`);
        bill.payment = 0; // Default payment to 0 if it's missing
      }
    });

    // Update `amountDue` for each unpaid bill and store the results
    const paymentResults = [];
    for (const unpaidBill of updatedData.unpaidBills) {
      const result = await calculateAmountDue(unpaidBill.billId, { amount: unpaidBill.payment });
      paymentResults.push(result);
    }

    // Re-fetch the updated bills to get the latest `amountDue` and `balanceAmount`
    const updatedBills = await PurchaseBill.find({ _id: { $in: updatedData.unpaidBills.map(bill => bill.billId) } });

    //openingDate
    const openingDate = generateOpeningDate({ timeZoneExp: organizationId.timeZoneExp, dateFormatExp: organizationId.dateFormatExp, dateSplit: organizationId.dateSplit });

    // Create and save new payment
    const payment = await createNewPayment(updatedData , openingDate, organizationId, userId, userName);

    //Response with the updated bills and the success message
    return res.status(200).json({
      message: 'Payment added successfully',  payment , updatedBills,

    });

  } catch (error) {
    console.error('Error adding payment:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};





exports.getAllPayment = async (req, res) => {
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

// Get One Payment 
exports.getPurchasePayment = async (req, res) => {
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



// Get Last payment Prefix
exports.getLastPaymentMadePrefix = async (req, res) => {
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
      const lastPrefix = series.vendorPayment + series.vendorPaymentNum;
      console.log(lastPrefix);

      res.status(200).json(lastPrefix);
  } catch (error) {
      console.error("Error fetching accounts:", error);
      res.status(500).json({ message: "Internal server error." });
  }
};

// Purchase Prefix
function vendorPaymentPrefix( cleanData, existingPrefix ) {
  const activeSeries = existingPrefix.series.find(series => series.status === true);
  if (!activeSeries) {
      return res.status(404).json({ message: "No active series found for the organization." });
  }
  cleanData.payment = `${activeSeries.vendorPayment}${activeSeries.vendorPaymentNum}`;

  activeSeries.vendorPaymentNum += 1;

  existingPrefix.save()

  return 
}





  //Clean Data 
function cleanSupplierData(data) {
    const cleanData = (value) => (value === null || value === undefined || value === "" ? undefined : value);
    return Object.keys(data).reduce((acc, key) => {
      acc[key] = cleanData(data[key]);
      return acc;
    }, {});
}







  // Validate Supplier and Organization
function validateSupplierAndOrganization(organizationExists, supplierExists, existingPrefix ,res) {
    if (!organizationExists) {
        res.status(404).json({ message: "Organization not found" });
        return false;
    }
    if (!supplierExists) {
        res.status(404).json({ message: "Supplier not found" });
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
function validateInputs( data, supplierExists, unpaidBills , organizationExists, paymentTableExist ,  res) {
  const validationErrors = validatePaymentData(data, supplierExists, unpaidBills, organizationExists , paymentTableExist);

  if (validationErrors.length > 0) {
    res.status(400).json({ message: validationErrors.join(", ") });
    return false;
  }
  return true;
}

// Function to create a new payment record
function createNewPayment(data, openingDate, organizationId, userId, userName) {
  const newPayment = new PurchasePayment({
    ...data,
    organizationId,
    createdDate: openingDate,
    userId,
    userName
  });
  return newPayment.save(); // Save the payment to the database
}


//Validate Data
function validatePaymentData( data, supplierExists, unpaidBills, paymentTable ) {
  const errors = [];

  console.log("bills Request :",unpaidBills);
  console.log("bills Fetched :",paymentTable);
  

  //Basic Info
  validateReqFields( data, supplierExists , errors );
  validatePaymentTable(unpaidBills, paymentTable, errors);


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
  console.log("validate:",unpaidBills , paymentTable)
  // Check for bill count mismatch
  validateField( unpaidBills.length !== paymentTable.length, "Mismatch in bills count between request and database.", errors  );

  // Iterate through each bills to validate individual fields
  unpaidBills.forEach((unpaidBill) => {
    const fetchedBills = paymentTable.find(it => it._id.toString() === unpaidBill.billId);

    // Check if item exists in the item table
    validateField( !fetchedBills, `Bill with ID ${unpaidBill.billId} was not found.`, errors );
    if (!fetchedBills) return; 

     // Validate bill number
     validateField( unpaidBill.billNumber !== fetchedBills.billNumber, `Bill Number Mismatch Bill Number: ${unpaidBill.billNumber}`, errors );

    // Validate bill date
    validateField( unpaidBill.billDate !== fetchedBills.billDate, `Bill Date Mismatch Bill Number: ${unpaidBill.billNumber} : ${unpaidBill.billDate}` , errors );

    // Validate duedate
    validateField( unpaidBill.dueDate !== fetchedBills.dueDate, `Due Date Mismatch for Bill Number${unpaidBill.billNumber}:  ${unpaidBill.dueDate}`, errors );

    // Validate billamount
    validateField( unpaidBill.billAmount !== fetchedBills.grandTotal, `Grand Total for Bill Number${unpaidBill.billNumber}: ${unpaidBill.billAmount}`, errors );

    // // 
    validateField( unpaidBill.amountDue !== fetchedBills.balanceAmount, `Amount Due for bill number ${unpaidBill.billNumber}: ${unpaidBill.amountDue}`, errors );

    
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


const calculateAmountDue = async (billId, { amount }) => {
  try {
    // Find the bill by its ID
    const bill = await PurchaseBill.findById(billId);

    if (!bill) {
      throw new Error(`Bill not found with ID: ${billId}`);
    }

    // Check if the payment amount is a valid number
    if (typeof amount !== 'number' || isNaN(amount)) {
      throw new Error(`Invalid payment amount: ${amount}`);
    }

    // Initialize fields if undefined
    bill.paidAmount = typeof bill.paidAmount === 'number' ? bill.paidAmount : 0;
    bill.balanceAmount = typeof bill.balanceAmount === 'number' ? bill.balanceAmount : bill.grandTotal;

    // Ensure grandTotal is valid
    if (typeof bill.grandTotal !== 'number' || isNaN(bill.grandTotal)) {
      throw new Error(`Invalid grandTotal for Bill ID: ${billId}`);
    }

    // Calculate new paidAmount and balanceAmount
    bill.paidAmount += amount;
    bill.balanceAmount = bill.grandTotal - bill.paidAmount;

    // Ensure values are within correct bounds
    if (bill.balanceAmount < 0) {
      bill.balanceAmount = 0;
    }
    if (bill.paidAmount > bill.grandTotal) {
      bill.paidAmount = bill.grandTotal;
    }

    // Save the updated bill with new balanceAmount and paidAmount
    await bill.save();

    // Log the updated bill status for debugging
    console.log(`Updated Bill ID ${billId}: Paid Amount: ${bill.paidAmount}, Balance Amount: ${bill.balanceAmount}`);

    // Check if payment is complete
    if (bill.balanceAmount === 0) {
      return {
        message: `Payment completed for Bill ID ${billId}. No further payments are needed.`,
        bill,
      };
    }

    return { message: 'Payment processed', bill };

  } catch (error) {
    console.error(`Error calculating amount due for Bill ID ${billId}:`, error);
    throw new Error(`Error calculating amount due for Bill ID ${billId}: ${error.message}`);
  }
};



const calculateTotalPaymentMade = async (cleanedData) => {
  let totalPayment = 0;

  // Sum the `payment` amounts from each unpaid bill in the array
  for (const bill of cleanedData.unpaidBills) {
    totalPayment += bill.payment || 0; // Ensure `payment` is a number and add it
  }

  // Assign the total to both `total` and `amountPaid` field in `cleanedData`
  cleanedData.total = totalPayment;
  cleanedData.amountPaid = totalPayment;

  // Calculate amountUsedForPayments and amountInExcess
  const paymentMade = cleanedData.paymentMade || 0;
  cleanedData.amountUsedForPayments = paymentMade - totalPayment;
  cleanedData.amountInExcess = paymentMade - totalPayment;

  return cleanedData;
};
