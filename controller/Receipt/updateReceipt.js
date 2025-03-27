const mongoose = require('mongoose');
const SalesReceipt = require('../../database/model/salesReceipt');
const TrialBalance = require("../../database/model/trialBalance");
const Invoice = require("../../database/model/salesInvoice");
const CustomerHistory = require("../../database/model/customerHistory");

const { dataExist, validation, calculation, accounts } = require("../Receipt/salesReceipt");
const { cleanData } = require("../../services/cleanData");

const moment = require("moment-timezone");


// Update Sales Receipt 
exports.updateReceipt = async (req, res) => {
    console.log("Update sales invoice:", req.body);
  
    try {
      const { organizationId, id: userId, userName } = req.user;
      const { receiptId } = req.params;  

      // Fetch existing sales receipt
      const existingSalesReceipt = await getExistingSalesReceipt(receiptId, organizationId, res);

      // Extract paymentAmount values
      const existingSalesReceiptInvoice = existingSalesReceipt.invoice;

      // Clean input data
      const cleanedData = cleanData(req.body);

      const { invoice, amountReceived, customerId } = cleanedData;      

      const invoiceIds = invoice.map(inv => inv.invoiceId);

      // Fetch the latest receipt for the given customerId and organizationId
      const result = await getLatestReceipt(receiptId, organizationId, customerId, invoiceIds, res);
      
      if (result.error) {
        return res.status(400).json({ message: result.error });
      }
    
      // Validate _id's
      const validateAllIds = validateIds({ invoiceIds, customerId });
      if (validateAllIds) {
        return res.status(400).json({ message: validateAllIds });
      }

      // Ensure `salesReceipt` field matches the existing order
      if (cleanedData.receipt !== existingSalesReceipt.receipt) {
        return res.status(400).json({
          message: `The provided salesReceipt does not match the existing record. Expected: ${existingSalesReceipt.receipt}`,
        });
      }

      // Fetch related data
      const { organizationExists, customerExists, paymentTable, existingPrefix } = await dataExist.dataExist( organizationId, invoice, customerId );  
      
      const { depositAcc, customerAccount } = await dataExist.accDataExists( organizationId, cleanedData.depositAccountId, cleanedData.customerId ); 
        
      //Data Exist Validation
      if (!validation.validateCustomerAndOrganization( organizationExists, customerExists, existingPrefix, res )) return;

      // Validate Inputs
      if (!validateInputs(cleanedData, invoice, paymentTable, organizationExists, depositAcc, customerAccount, res)) return;

      const updatedData = await calculation.calculateTotalPaymentMade(cleanedData, amountReceived );
      
      // Validate invoices
      const validatedInvoices = validation.validateInvoices(updatedData.invoice);
      
      // Process invoices
      await processInvoices(validatedInvoices, existingSalesReceiptInvoice);

      // Validate Inputs
      if (!validateUpdatedInputs(cleanedData, existingSalesReceipt, res)) return;

      // Re-fetch the updated invoice to get the latest `amountDue` and `balanceAmount`
      await SalesReceipt.find({ _id: { $in: updatedData.invoice.map(receipt => receipt.invoiceId) } });  

      cleanedData.createdDateTime = moment.tz(cleanedData.paymentDate, "YYYY-MM-DDTHH:mm:ss.SSS[Z]", organizationExists.timeZoneExp).toISOString();           

      const mongooseDocument = SalesReceipt.hydrate(existingSalesReceipt);
      Object.assign(mongooseDocument, cleanedData);
      const savedSalesReceipt = await mongooseDocument.save();
      if (!savedSalesReceipt) {
        return res.status(500).json({ message: "Failed to update sales receipt" });
      }

      // Add entry to Customer History
      const customerHistoryEntry = new CustomerHistory({
        organizationId,
        operationId: savedSalesReceipt._id,
        customerId,
        title: "Payment Receipt Updated",
        description: `Payment Receipt ${savedSalesReceipt.receipt} updated by ${userName}`,
        userId: userId,
        userName: userName,
      });

      await customerHistoryEntry.save();

      //Journal
      await journal( savedSalesReceipt, depositAcc, customerAccount );
      
      res.status(200).json({ message: "Sale receipt updated successfully", savedSalesReceipt });
      // console.log("Sale receipt updated successfully:", savedSalesReceipt);
  
    } catch (error) {
      console.error("Error updating sale receipt:", error);
      res.status(500).json({ message: "Internal server error" });
    }
};




// Delete Sales Receipt
exports.deleteSalesReceipt = async (req, res) => {
  console.log("Delete sales receipt request received:", req.params);

  try {
      const { organizationId, id: userId, userName } = req.user;
      const { receiptId } = req.params;

      // Validate receiptId
      if (!mongoose.Types.ObjectId.isValid(receiptId) || receiptId.length !== 24) {
          return res.status(400).json({ message: `Invalid Sales Receipt ID: ${receiptId}` });
      }

      // Fetch existing sales receipt
      const existingSalesReceipt = await getExistingSalesReceipt(receiptId, organizationId, res);

      const { invoice, customerId } = existingSalesReceipt;

      const invoiceIds = invoice.map(inv => inv.invoiceId);      

      // Fetch the latest receipt for the given customerId and organizationId
      const latestReceipt = await SalesReceipt.findOne({ 
        organizationId, 
        customerId,
        "invoice.invoiceId": { $in: invoiceIds }, 
      }).sort({ createdDateTime: -1 }); // Sort by createdDateTime in descending order
    
      if (!latestReceipt) {
          console.log("No sales receipts found for this customer.");
          return res.status(404).json({ message: "No sales receipts found for this customer." });
      }
    
      // Check if the provided receiptId matches the latest one
      if (latestReceipt._id.toString() !== receiptId) {
        return res.status(400).json({
          message: "Only the latest sales receipt can be deleted."
        });
      }

      // Extract sales receipt invoices
      const existingSalesReceiptInvoice = existingSalesReceipt.invoice;

      // Add entry to Customer History
      const customerHistoryEntry = new CustomerHistory({
        organizationId,
        operationId: existingSalesReceipt._id,
        customerId,
        title: "Payment Receipt Deleted",
        description: `Payment Receipt ${existingSalesReceipt.receipt} deleted by ${userName}`,
        userId: userId,
        userName: userName,
      });

      // Delete the sales receipt
      const deletedSalesReceipt = await existingSalesReceipt.deleteOne();
      if (!deletedSalesReceipt) {
          console.error("Failed to delete sales receipt.");
          return res.status(500).json({ message: "Failed to delete sales receipt!" });
      }

      await customerHistoryEntry.save();

      // Fetch existing TrialBalance's createdDateTime
      const existingTrialBalance = await TrialBalance.findOne({ 
        organizationId: existingSalesReceipt.organizationId,
        operationId: existingSalesReceipt._id,
      });  
      // If there are existing entries, delete them
      if (existingTrialBalance) {
        await TrialBalance.deleteMany({
          organizationId: existingSalesReceipt.organizationId,
          operationId: existingSalesReceipt._id,
        });
        console.log(`Deleted existing TrialBalance entries for operationId: ${existingSalesReceipt._id}`);
      }

      // Return balance amount after deletion
      await returnBalanceAmount( existingSalesReceiptInvoice );

      res.status(200).json({ message: "Sales receipt deleted successfully" });
      console.log("Sales receipt deleted successfully with ID:", receiptId);

  } catch (error) {
      console.error("Error deleting sales receipt:", error);
      res.status(500).json({ message: "Internal server error" });
  }
};






// Get Existing Sales Receipt
async function getExistingSalesReceipt(receiptId, organizationId, res) {
  const existingSalesReceipt = await SalesReceipt.findOne({ _id: receiptId, organizationId });
  if (!existingSalesReceipt) {
      console.log("Sales receipt not found with ID:", receiptId);
      return res.status(404).json({ message: "Sales receipt not found" });
  }
  return existingSalesReceipt;
}



// Get Latest Receipt
async function getLatestReceipt(receiptId, organizationId, customerId, invoiceIds, res) {
  const latestReceipt = await SalesReceipt.findOne({ 
      organizationId, 
      customerId,
      "invoice.invoiceId": { $in: invoiceIds }, 
  }).sort({ createdDateTime: -1 }); // Sort by createdDateTime in descending order

  if (!latestReceipt) {
      console.log("No sales receipts found for this customer.");
      return { error: "No sales receipts found for this customer." };
    }

  // Check if the provided receiptId matches the latest one
  if (latestReceipt._id.toString() !== receiptId) {
    return { error: "Only the latest sales receipt can be edited" };
  }

  return latestReceipt;
}




async function returnBalanceAmount(existingSalesReceiptInvoice) {
  try {
    for (const existingInvoice of existingSalesReceiptInvoice) {
      const { invoiceId, paymentAmount, balanceAmount } = existingInvoice;

      // Find the invoice by its ID
      const invoice = await Invoice.findById(invoiceId);
      if (!invoice) {
        console.warn(`Invoice not found with ID: ${invoiceId}`);
        continue;
      }

      // Update the invoice's paidAmount and balanceAmount
      invoice.paidAmount -= paymentAmount;
      invoice.balanceAmount = balanceAmount;

      // Save the updated invoice
      await invoice.save();
      console.log(`Updated Invoice ID: ${invoiceId} | Paid Amount: ${invoice.paidAmount} | Balance Amount: ${invoice.balanceAmount}`);
    }
  } catch (error) {
    console.error("Error updating invoice balances:", error);
    throw new Error("Failed to update invoice balances");
  }
}






function validateIds({ invoiceIds, customerId }) {
    // Validate Customer ID
    if (!mongoose.Types.ObjectId.isValid(customerId) || customerId.length !== 24) {
      return `Invalid Customer ID: ${customerId}`;
    }
  
    // Validate Invoice IDs
    const invalidInvoiceIds = invoiceIds.filter(invId => !mongoose.Types.ObjectId.isValid(invId) || invId.length !== 24);
    if (invalidInvoiceIds.length > 0) {
      return `Invalid invoice IDs: ${invalidInvoiceIds.join(', ')}`;
    }
  
    // Check for duplicate Invoice IDs
    const uniqueInvoiceIds = new Set(invoiceIds);
    if (uniqueInvoiceIds.size !== invoiceIds.length) {
      return "Duplicate invoice found in the list.";
    }
  
    // Return null if all validations pass
    return null;
}





// Utility function to process invoices
async function processInvoices(invoices, existingSalesReceiptInvoice) {
  
  const results = [];
  for (const invoice of invoices) {
    try {
      const result = await calculateAmountDue(invoice.invoiceId, { amount: invoice.paymentAmount }, existingSalesReceiptInvoice);
      results.push(result);
    } catch (error) {
      console.error(`Error processing Invoice ID: ${invoice.invoiceId}`, error);
      throw error; // Re-throw for higher-level error handling
    }
  }
  return results;
}


const calculateAmountDue = async (invoiceId, { amount }, existingSalesReceiptInvoice) => {
  try {
    // Find the bill by its ID
    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      throw new Error(`Invoice not found with ID: ${invoiceId}`);
    }

    // Find the corresponding invoice in existingSalesReceiptInvoice
    const existingInvoice = existingSalesReceiptInvoice.find((inv) => inv.invoiceId.toString() === invoiceId.toString());
    if (!existingInvoice) {
      throw new Error(`No matching invoice found in existingSalesReceiptInvoice for ID: ${invoiceId}`);
    }

    // Initialize fields if undefined
    invoice.paidAmount = typeof invoice.paidAmount === 'number' ? invoice.paidAmount : 0;
    invoice.balanceAmount = typeof invoice.balanceAmount === 'number' ? invoice.balanceAmount : invoice.totalAmount;

    // Check if paymentAmount and amount are equal
    if (existingInvoice.paymentAmount === amount) {

      invoice.balanceAmount = existingInvoice.balanceAmount;
      await invoice.save();
      console.log(`No changes required for Invoice ID ${invoiceId}: paymentAmount and amount are equal.`);

    } else {
      
      if (existingInvoice.paymentAmount < amount) {
        // If the incoming amount is greater than the existing paymentAmount, increase paidAmount
        const incAmt = amount - existingInvoice.paymentAmount;
        invoice.paidAmount += incAmt;
      } else {
        // If the incoming amount is less than the existing paymentAmount, decrease paidAmount
        const decAmt = (existingInvoice.paymentAmount - amount);
        invoice.paidAmount -= decAmt;
      }

      // Recalculate balanceAmount
      invoice.balanceAmount = existingInvoice.balanceAmount - amount;

      // Ensure values are within correct bounds
      if (invoice.balanceAmount < 0) {
        invoice.balanceAmount = 0;
      }
      if (invoice.paidAmount > invoice.totalAmount) {
        invoice.paidAmount = invoice.totalAmount;
      }

      await invoice.save();
    }

    // Log the updated bill status for debugging
    console.log(`Updated Invoice ID ${invoiceId}: Paid Amount: ${invoice.paidAmount}, Balance Amount: ${invoice.balanceAmount}`);

    // Check if payment is complete
    if (invoice.balanceAmount === 0) {
      return {
        message: `Payment completed for Invoice ID ${invoiceId}. No further payments are needed.`,
        invoice,
      };
    }
    
    return { message: 'Payment processed', invoice };

  } catch (error) {
    console.error(`Error calculating balance amount for Invoice ID ${invoiceId}:`, error);
    throw new Error(`Error calculating balance amount for Invoice ID ${invoiceId}: ${error.message}`);
  }
};








// Field validation utility
function validateField(condition, errorMsg, errors) {
  if (condition) errors.push(errorMsg);
}



//Validate inputs
function validateInputs( data, invoice, paymentTable, organizationExists, depositAcc, customerAccount, res) {
  const validationErrors = validatePaymentData(data, invoice, paymentTable, organizationExists, depositAcc, customerAccount);

  if (validationErrors.length > 0) {
    res.status(400).json({ message: validationErrors.join(", ") });
    return false;
  }
  return true;
}


//Validate Data
function validatePaymentData( data, invoice, paymentTable, organizationExists, depositAcc, customerAccount ) {
  const errors = [];
  //Basic Info
  validateReqFields( data, depositAcc, customerAccount, errors );
  validatePaymentTable(invoice, paymentTable, errors);
  validateFloatFields([ 'amountReceived','amountUsedForPayments','total'], data, errors);

  return errors;
}


//Valid Req Fields
function validateReqFields( data, depositAcc, customerAccount, errors ) {
  validateField( typeof data.customerId === 'undefined', "Please select a customer", errors  );
  validateField( typeof data.invoice === 'undefined' || (Array.isArray(data.invoice) && data.invoice.length === 0), "Select an invoice", errors  );
  validateField( typeof data.amountReceived === 'undefined' || data.amountReceived === 0 || typeof data.amountUsedForPayments === 'undefined' || data.amountUsedForPayments === 0, "Enter amount received", errors  );
  validateField( typeof data.depositAccountId === 'undefined' , "Select deposit account", errors  );
  validateField( typeof data.paymentMode === 'undefined' , "Select payment mode", errors  );
  validateField( typeof data.paymentDate === 'undefined' , "Select payment date", errors  );

  validateField( !depositAcc && typeof data.amountReceived !== 'undefined' , "Deposit Account not found", errors  );
  validateField( !customerAccount && typeof data.amountReceived !== 'undefined' , "Customer Account not found", errors  );
}


// Function to Validate Item Table 
function validatePaymentTable(invoice, paymentTable, errors) {

  // Check for bill count mismatch
  validateField( invoice.length !== paymentTable.length, "Mismatch in invoice count between request and database.", errors  );

  // Iterate through each bills to validate individual fields
  invoice.forEach((invoices) => {
    const fetchedInvoices = paymentTable.find(it => it._id.toString() === invoices.invoiceId);

    // Check if item exists in the item table
    validateField( !fetchedInvoices, `Invoice with ID ${invoices.invoiceId} was not found.`, errors );
    if (!fetchedInvoices) return; 

    // Validate invoice number
    validateField( invoices.salesInvoice !== fetchedInvoices.salesInvoice, `Invoice Number Mismatch Invoice Number: ${fetchedInvoices.salesInvoice}`, errors );

    // Validate bill date
    validateField( invoices.salesInvoiceDate !== fetchedInvoices.salesInvoiceDate, `Invoice Date Mismatch Invoice Number: ${invoices.salesInvoice} : ${fetchedInvoices.salesInvoiceDate}` , errors );

    // Validate dueDate
    validateField( invoices.dueDate !== fetchedInvoices.dueDate, `Due Date Mismatch for Invoice Number ${invoices.salesInvoice}:  ${fetchedInvoices.dueDate}`, errors );

    // Validate billAmount
    validateField( invoices.totalAmount !== fetchedInvoices.totalAmount, `Invoice Amount for Invoice Number ${invoices.salesInvoice}: ${fetchedInvoices.totalAmount}`, errors );
    
    // Validate float fields
    validateFloatFields(['balanceAmount', 'totalAmount', 'paymentAmount'], invoices, errors);
  });
}





//Validate inputs
function validateUpdatedInputs(cleanedData, existingSalesReceiptInvoice, res) {
  const validationErrors = validateBalanceAmtData(cleanedData, existingSalesReceiptInvoice);

  if (validationErrors.length > 0) {
    res.status(400).json({ message: validationErrors.join(", ") });
    return false;
  }
  return true;
}

//Validate Data
function validateBalanceAmtData( cleanedData, existingSalesReceiptInvoice ) {
  const errors = [];
  validateAmtDueData(cleanedData, existingSalesReceiptInvoice, errors);
  return errors;
}

//Function to Validate Amount Due 
function validateAmtDueData(cleanedData, existingSalesReceiptInvoice, errors) {

  const receiptInvoice = cleanedData.invoice;
  const existingReceiptInvoice = existingSalesReceiptInvoice.invoice;

  // Check if receiptInvoice and existingReceiptInvoice are valid arrays
  validateField(!Array.isArray(receiptInvoice), "Invalid receipt invoice data.", errors);
  validateField(!Array.isArray(existingReceiptInvoice), "Invalid existing receipt invoice data.", errors);
  if (!Array.isArray(receiptInvoice) || !Array.isArray(existingReceiptInvoice)) return;

  validateField( receiptInvoice.length !== existingReceiptInvoice.length, "Mismatch in receipt invoice count between request and database.", errors  );

  receiptInvoice.forEach((RInv) => {
    const existingRInv = existingReceiptInvoice.find(inv => inv.invoiceId.toString() === RInv.invoiceId.toString());

    validateField( !existingRInv, `Invoice with ID ${RInv.invoiceId} was not found.`, errors );
    if (!existingRInv) return;

    validateField( RInv.salesInvoice !== existingRInv.salesInvoice, `Invoice Number Mismatch Receipt Invoice Number: ${existingRInv.salesInvoice}`, errors );
    validateField( RInv.salesInvoiceDate !== existingRInv.salesInvoiceDate, `Invoice Date Mismatch Receipt Invoice Number: ${RInv.salesInvoice} : ${existingRInv.salesInvoiceDate}` , errors );
    validateField( RInv.dueDate !== existingRInv.dueDate, `Due Date Mismatch for Receipt Invoice Number ${RInv.salesInvoice}:  ${existingRInv.dueDate}`, errors );
    validateField( RInv.totalAmount !== existingRInv.totalAmount, `Invoice Amount for Receipt Invoice Number ${RInv.salesInvoice}: ${existingRInv.totalAmount}`, errors );
    validateField( RInv.balanceAmount !== existingRInv.balanceAmount, `Amount Due for Receipt Invoice number ${RInv.salesInvoice}: ${existingRInv.balanceAmount}`, errors );
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










async function journal( savedReceipt, depositAcc, customerAccount ) { 

    await TrialBalance.deleteMany({
        organizationId: savedReceipt.organizationId,
        operationId: savedReceipt._id,
    });

        
    const customerPaid = {
      organizationId: savedReceipt.organizationId,
      operationId: savedReceipt._id,
      transactionId: savedReceipt.receipt,
      accountId: customerAccount._id || undefined,
      action: "Receipt",
      debitAmount: 0,
      creditAmount: savedReceipt.amountReceived || 0,
      remark: savedReceipt.note,
      createdDateTime:savedReceipt.createdDateTime
    };
    const depositAccount = {
      organizationId: savedReceipt.organizationId,
      operationId: savedReceipt._id,
      transactionId: savedReceipt.receipt,
      accountId: depositAcc._id || undefined,
      action: "Receipt",
      debitAmount: savedReceipt.amountReceived || 0,
      creditAmount: 0,
      remark: savedReceipt.note,
      createdDateTime:savedReceipt.createdDateTime
    };
    
    console.log("customerPaid", customerPaid.debitAmount,  customerPaid.creditAmount);
    console.log("depositAccount", depositAccount.debitAmount,  depositAccount.creditAmount);
  
    const  debitAmount = customerPaid.debitAmount + depositAccount.debitAmount ;
    const  creditAmount = customerPaid.creditAmount + depositAccount.creditAmount ;
  
    console.log("Total Debit Amount: ", debitAmount );
    console.log("Total Credit Amount: ", creditAmount );
    
    createTrialEntry( customerPaid )
    createTrialEntry( depositAccount )
}
  
  


  
async function createTrialEntry( data ) {
    const newTrialEntry = new TrialBalance({
        organizationId:data.organizationId,
        operationId:data.operationId,
        transactionId: data.transactionId,
        accountId: data.accountId,
        action: data.action,
        debitAmount: data.debitAmount,
        creditAmount: data.creditAmount,
        remark: data.remark,
        createdDateTime: data.createdDateTime
    });
    
    await newTrialEntry.save();
  
}