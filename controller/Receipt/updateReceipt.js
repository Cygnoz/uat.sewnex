const mongoose = require('mongoose');
const SalesReceipt = require('../../database/model/salesReceipt');
const TrialBalance = require("../../database/model/trialBalance");
const { dataExist, validation, calculation, accounts } = require("../Receipt/salesReceipt");
const { cleanData } = require("../../services/cleanData");



// Update Sales Receipt 
exports.updateReceipt = async (req, res) => {
    console.log("Update sales invoice:", req.body);
  
    try {
      const { organizationId, id: userId, userName } = req.user;
      const { receiptId } = req.params;      

      // Fetch existing sales receipt
      const existingSalesReceipt = await SalesReceipt.findOne({ _id: receiptId, organizationId });
      if (!existingSalesReceipt) {
        console.log("Sales receipt not found with ID:", receiptId);
        return res.status(404).json({ message: "Sales receipt not found" });
      }

      // Clean input data
      const cleanedData = cleanData(req.body);

      const { invoice, amountReceived, customerId } = cleanedData;      

      const invoiceIds = invoice.map(inv => inv.invoiceId);
    
      // Validate _id's
      const validateAllIds = validateIds({ invoiceIds, customerId });
      if (validateAllIds) {
        return res.status(400).json({ message: validateAllIds });
      }

      // Fetch related data
      const { organizationExists, customerExists, paymentTable, existingPrefix } = await dataExist.dataExist( organizationId, invoice, customerId );  
      
      const { depositAcc, customerAccount } = await dataExist.accDataExists( organizationId, cleanedData.depositAccountId, cleanedData.customerId ); 
        
      //Data Exist Validation
      if (!validation.validateCustomerAndOrganization( organizationExists, customerExists, existingPrefix, res )) return;

      // Call the new function to calculate actual amountDue
      const { totalPaymentAmount } = await calculateActualAmountDue( organizationId, customerId, invoiceIds, receiptId );
      console.log("totalPaymentAmount...................",totalPaymentAmount);
      
        
      // Validate Inputs
      if (!validateInputs(cleanedData, invoice, paymentTable, totalPaymentAmount, organizationExists, depositAcc, customerAccount, res)) return;
  
      const updatedData = await calculation.calculateTotalPaymentMade(cleanedData, amountReceived );

      // Validate invoices
      const validatedInvoices = validation.validateInvoices(updatedData.invoice);
  
      // Process invoices
      const paymentResults = await calculation.processInvoices(validatedInvoices);
      console.log('Invoice processing complete:', paymentResults);

      // Re-fetch the updated invoice to get the latest `amountDue` and `balanceAmount`
      await SalesReceipt.find({ _id: { $in: updatedData.invoice.map(receipt => receipt.invoiceId) } });  
  
      // Ensure `salesReceipt` field matches the existing order
      if (cleanedData.receipt !== existingSalesReceipt.receipt) {
        return res.status(400).json({
          message: `The provided salesReceipt does not match the existing record. Expected: ${existingSalesReceipt.receipt}`,
        });
      }

      const mongooseDocument = SalesReceipt.hydrate(existingSalesReceipt);
      Object.assign(mongooseDocument, cleanedData);
      const savedSalesReceipt = await mongooseDocument.save();

      if (!savedSalesReceipt) {
        return res.status(500).json({ message: "Failed to update sales receipt" });
      }

      //Journal
      await journal( savedSalesReceipt, depositAcc, customerAccount );
      
      res.status(200).json({ message: "Sale receipt updated successfully", savedSalesReceipt });
      // console.log("Sale receipt updated successfully:", savedSalesReceipt);
  
    } catch (error) {
      console.error("Error updating sale receipt:", error);
      res.status(500).json({ message: "Internal server error" });
    }
};






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




const calculateActualAmountDue = async ( organizationId, customerId, invoiceIds, receiptId ) => {
  try {
      // Fetch invoices for the given customer and organization, excluding the edited receipt
      const invoicesForCustomer = await SalesReceipt.find({ 
          organizationId, 
          "invoice.invoiceId": { $in: invoiceIds }, 
          customerId,
          _id: { $ne: receiptId } // Exclude the edited receipt
      });

      let totalPaymentAmount = 0;

      invoicesForCustomer.forEach((salesReceipt) => {
          salesReceipt.invoice.forEach((inv) => {
              if (invoiceIds.includes(inv.invoiceId.toString())) {
                  totalPaymentAmount += inv.paymentAmount;
              }
          });
      });

      return { totalPaymentAmount };
  } catch (error) {
      console.error("Error calculating totalPaymentAmount:", error);
      throw new Error("Failed to calculate totalPaymentAmount");
  }
};






//Validate inputs
function validateInputs( data, invoice, paymentTable, totalPaymentAmount, organizationExists, depositAcc, customerAccount, res) {
  const validationErrors = validatePaymentData(data, invoice, paymentTable, totalPaymentAmount, organizationExists, depositAcc, customerAccount);

  if (validationErrors.length > 0) {
    res.status(400).json({ message: validationErrors.join(", ") });
    return false;
  }
  return true;
}


//Validate Data
function validatePaymentData( data, invoice, paymentTable, totalPaymentAmount, organizationExists, depositAcc, customerAccount ) {
  const errors = [];

  // console.log("invoice Request :",invoice);
  // console.log("invoice Fetched :",paymentTable);
  
  //Basic Info
  validateReqFields( data, depositAcc, customerAccount, errors );
  validatePaymentTable(invoice, paymentTable, totalPaymentAmount, errors);
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
function validatePaymentTable(invoice, paymentTable, totalPaymentAmount, errors) {
  // console.log("validate.......:",invoice , paymentTable)  //invoice - invoice in the receipt, paymentTable - exact invoice

  // Check for bill count mismatch
  validateField( invoice.length !== paymentTable.length, "Mismatch in invoice count between request and database.", errors  );

  // Iterate through each bills to validate individual fields
  invoice.forEach((invoices) => {
    const fetchedInvoices = paymentTable.find(it => it._id.toString() === invoices.invoiceId);

    // Check if item exists in the item table
    validateField( !fetchedInvoices, `Invoice with ID ${invoices.invoiceId} was not found.`, errors );
    if (!fetchedInvoices) return; 

    console.log("1111........",invoices, fetchedInvoices);  //invoices - invoice in the receipt, fetchedInvoices - paymentTable/exact invoice

    // Validate invoice number
    validateField( invoices.salesInvoice !== fetchedInvoices.salesInvoice, `Invoice Number Mismatch Invoice Number: ${fetchedInvoices.salesInvoice}`, errors );

    // Validate bill date
    validateField( invoices.salesInvoiceDate !== fetchedInvoices.salesInvoiceDate, `Invoice Date Mismatch Invoice Number: ${invoices.salesInvoice} : ${fetchedInvoices.salesInvoiceDate}` , errors );

    // Validate dueDate
    validateField( invoices.dueDate !== fetchedInvoices.dueDate, `Due Date Mismatch for Invoice Number ${invoices.salesInvoice}:  ${fetchedInvoices.dueDate}`, errors );

    // Validate billAmount
    validateField( invoices.totalAmount !== fetchedInvoices.totalAmount, `Invoice Amount for Invoice Number ${invoices.salesInvoice}: ${fetchedInvoices.totalAmount}`, errors );
    
    // Validate amountDue
    const actualBalanceAmt = fetchedInvoices.totalAmount - totalPaymentAmount;
    console.log("totalPaymentAmount:", totalPaymentAmount);
    console.log("actualBalanceAmt:", actualBalanceAmt);
    validateField( invoices.balanceAmount !== actualBalanceAmt, `Amount Due for Invoice number ${invoices.salesInvoice}: ${actualBalanceAmt}`, errors );

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










async function journal( savedReceipt, depositAcc, customerAccount ) { 
    
    // Fetch existing TrialBalance's createdDateTime
    const existingTrialBalance = await TrialBalance.findOne({
        organizationId: savedReceipt.organizationId,
        operationId: savedReceipt._id,
    });  

    const createdDateTime = existingTrialBalance ? existingTrialBalance.createdDateTime : null;

    // If there are existing entries, delete them
    if (existingTrialBalance) {
      await TrialBalance.deleteMany({
        organizationId: savedReceipt.organizationId,
        operationId: savedReceipt._id,
      });
      console.log(`Deleted existing TrialBalance entries for operationId: ${savedReceipt._id}`);
    }
        
    const customerPaid = {
      organizationId: savedReceipt.organizationId,
      operationId: savedReceipt._id,
      transactionId: savedReceipt.payment,
      accountId: customerAccount._id || undefined,
      action: "Receipt",
      debitAmount: 0,
      creditAmount: savedReceipt.amountReceived || 0,
      remark: savedReceipt.note,
    };
    const depositAccount = {
      organizationId: savedReceipt.organizationId,
      operationId: savedReceipt._id,
      transactionId: savedReceipt.payment,
      accountId: depositAcc._id || undefined,
      action: "Receipt",
      debitAmount: savedReceipt.amountReceived || 0,
      creditAmount: 0,
      remark: savedReceipt.note,
    };
    
    console.log("customerPaid", customerPaid.debitAmount,  customerPaid.creditAmount);
    console.log("depositAccount", depositAccount.debitAmount,  depositAccount.creditAmount);
  
    const  debitAmount = customerPaid.debitAmount + depositAccount.debitAmount ;
    const  creditAmount = customerPaid.creditAmount + depositAccount.creditAmount ;
  
    console.log("Total Debit Amount: ", debitAmount );
    console.log("Total Credit Amount: ", creditAmount );
    
    createTrialEntry( customerPaid, createdDateTime )
    createTrialEntry( depositAccount, createdDateTime )
}
  
  


  
async function createTrialEntry( data, createdDateTime ) {
    const newTrialEntry = new TrialBalance({
        organizationId:data.organizationId,
        operationId:data.operationId,
        transactionId: data.transactionId,
        accountId: data.accountId,
        action: data.action,
        debitAmount: data.debitAmount,
        creditAmount: data.creditAmount,
        remark: data.remark,
        createdDateTime: createdDateTime
    });
    
    await newTrialEntry.save();
  
}