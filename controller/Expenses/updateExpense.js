const Organization = require("../../database/model/organization");
const Expense = require("../../database/model/expense");
const Category = require("../../database/model/expenseCategory");
const Account = require("../../database/model/account")
const TrialBalance = require("../../database/model/trialBalance");
const Supplier = require('../../database/model/supplier');
const Tax = require('../../database/model/tax');  
const mongoose = require('mongoose');
// const { ObjectId } = require('mongodb');
const { cleanData } = require("../../services/cleanData");
const { dataExist, validation, calculation, accounts } = require("../Expenses/expenseController");




// Update Expense 
exports.updateExpense = async (req, res) => {
    console.log("Update expense:", req.body);
  
    try {
      const { organizationId } = req.user;
      const { expenseId } = req.params;  

      // Fetch existing expense
      const existingExpense = await Expense.findOne({ _id: expenseId, organizationId });
      if (!existingExpense) {
        console.log("Expense not found with ID:", expenseId);
        return res.status(404).json({ message: "Expense not found" });
      }

      // Clean input data
      const cleanedData = cleanData(req.body);

      const { supplierId, paidThroughAccountId, expense } = cleanedData;
      const expenseIds = expense.map(e => e.expenseAccountId);
    
      // Validate _id's
      const validateAllIds = validateIds({
        supplierId,
        paidThroughAccountId,
        expenseIds,
        cleanedData
      });
      if (validateAllIds) {
        return res.status(400).json({ message: validateAllIds });
      }
  
      // Ensure `expenseNumber` field matches the existing expense
      if (cleanedData.expenseNumber !== existingExpense.expenseNumber) {
        return res.status(400).json({
          message: `The provided expenseNumber does not match the existing record. Expected: ${existingExpense.expenseNumber}`,
        });
      }

      // Fetch related data
      const { organizationExists, accountExist, supplierExist, existingPrefix, defaultAccount } = await dataExist.dataExist( organizationId, supplierId );  
      
      const { paidThroughAcc } = await dataExist.accDataExists( organizationId, cleanedData.paidThroughAccountId );
      
      // Extract all account IDs from accountExist
      const accountIds = accountExist.map(account => account._id.toString());
      
      // Check if each expense's expenseAccountId exists in allAccounts
      if(!accountIds.includes(cleanedData))
      for (let expenseItem of cleanedData.expense) {
          if (!accountIds.includes(expenseItem.expenseAccountId)) {
              return res.status(404).json({ message: `Account with ID ${expenseItem.expenseAccountId} not found` });
          }
      }
  
      //Data Exist Validation
      if (!validation.validateOrganizationSupplierAccount( organizationExists, accountExist, supplierExist, supplierId, existingPrefix, defaultAccount, res )) return;
        
      // Validate Inputs
      if (!validation.validateInputs(cleanedData, organizationExists, defaultAccount, paidThroughAcc, res)) return;
  
      // Tax Type 
      calculation.taxMode(cleanedData);

      //Default Account
      const { defAcc, error } = await defaultAccounting( cleanedData, defaultAccount, organizationExists );
      if (error) { 
        res.status(400).json({ message: error }); 
        return false; 
      }

      // Calculate Expense 
      if (!calculation.calculateExpense( cleanedData, res )) return;

      const mongooseDocument = Expense.hydrate(existingExpense);
      Object.assign(mongooseDocument, cleanedData);
      const savedExpense = await mongooseDocument.save();
      if (!savedExpense) {
        return res.status(500).json({ message: "Failed to update expense" });
      }

      //Journal
      await journal(savedExpense, defAcc, paidThroughAcc);
  
      res.status(200).json({ message: "Expense updated successfully", savedExpense });  
    } catch (error) {
      console.error("Error updating expense:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };







  function validateIds({ supplierId, paidThroughAccountId, expenseIds, cleanedData }) {
      // Validate Supplier ID
      if (!mongoose.Types.ObjectId.isValid(supplierId) || supplierId.length !== 24) {
        return res.status(400).json({ message: `Invalid supplier ID: ${supplierId}` });
      }
    
      // Validate paidThrough Account ID if applicable
      if ((!mongoose.Types.ObjectId.isValid(paidThroughAccountId) || paidThroughAccountId.length !== 24) && cleanedData.paidThroughAccountId !== undefined) {
        return "Select paid through account!";
      }
    
      // Validate expenseIds
      const invalidExpenseIds = expenseIds.filter(expenseAccountId => !mongoose.Types.ObjectId.isValid(expenseAccountId) || expenseAccountId.length !== 24);
      if (invalidExpenseIds.length > 0) {
        return res.status(400).json({ message: `Invalid item IDs: ${invalidExpenseIds.join(', ')}` });
      } 

      // Check for duplicate expenseIds
      const uniqueExpenseIds = new Set(expenseIds);
      if (uniqueExpenseIds.size !== expenseIds.length) {
        return res.status(400).json({ message: "Duplicate Expense found" });
      }
    
      // Return null if all validations pass
      return null;
    }









    async function journal( savedExpense, defAcc, paidThroughAcc ) { 

      // Fetch existing TrialBalance's createdDateTime
      const existingTrialBalance = await TrialBalance.findOne({
        organizationId: savedExpense.organizationId,
        operationId: savedExpense._id,
      });  

      const createdDateTime = existingTrialBalance ? existingTrialBalance.createdDateTime : null;

      // If there are existing entries, delete them
      if (existingTrialBalance) {
        await TrialBalance.deleteMany({
          organizationId: savedExpense.organizationId,
          operationId: savedExpense._id,
        });
        console.log(`Deleted existing TrialBalance entries for operationId: ${savedExpense._id}`);
      }

      const cgst = {
        organizationId: savedExpense.organizationId,
        operationId: savedExpense._id,
        transactionId: savedExpense.expenseNumber,
        date: savedExpense.createdDate,
        accountId: defAcc.outputCgst || undefined,
        action: "Expense",
        debitAmount: savedExpense.cgst || 0,
        creditAmount: 0,
        remark: savedExpense.expense.note,
      };
      const sgst = {
        organizationId: savedExpense.organizationId,
        operationId: savedExpense._id,
        transactionId: savedExpense.expenseNumber,
        date: savedExpense.createdDate,
        accountId: defAcc.outputSgst || undefined,
        action: "Expense",
        debitAmount: savedExpense.sgst || 0,
        creditAmount: 0,
        remark: savedExpense.expense.note,
      };
      const igst = {
        organizationId: savedExpense.organizationId,
        operationId: savedExpense._id,
        transactionId: savedExpense.expenseNumber,
        date: savedExpense.createdDate,
        accountId: defAcc.outputIgst || undefined,
        action: "Expense",
        debitAmount: savedExpense.igst || 0,
        creditAmount: 0,
        remark: savedExpense.expense.note,
      };
      const vat = {
        organizationId: savedExpense.organizationId,
        operationId: savedExpense._id,
        transactionId: savedExpense.expenseNumber,
        date: savedExpense.createdDate,
        accountId: defAcc.outputVat || undefined,
        action: "Expense",
        debitAmount: savedExpense.vat || 0,
        creditAmount: 0,
        remark: savedExpense.expense.note,
      };
      const paidThroughAccount = {
        organizationId: savedExpense.organizationId,
        operationId: savedExpense._id,
        transactionId: savedExpense.expenseNumber,
        accountId: paidThroughAcc || undefined,
        action: "Expense",
        debitAmount: 0,
        creditAmount: savedExpense.grandTotal || 0,
        remark: savedExpense.expense.note,
      };
    
      
    
      let expenseTotalDebit = 0;
    
      if (Array.isArray(savedExpense.expense)) {
        savedExpense.expense.forEach((entry) => {
          console.log( "Account Log", entry.expenseAccountId, entry.amount );      
          expenseTotalDebit += entry.amount || 0;
        });
        console.log("Total Debit Amount from expense:", expenseTotalDebit);
      } else {
        console.error("Expense is not an array or is undefined.");
      }
    
      
    
    
      console.log("cgst", cgst.debitAmount,  cgst.creditAmount);
      console.log("sgst", sgst.debitAmount,  sgst.creditAmount);
      console.log("igst", igst.debitAmount,  igst.creditAmount);
      console.log("vat", vat.debitAmount,  vat.creditAmount);
      console.log("paidThroughAccount", paidThroughAccount.debitAmount,  paidThroughAccount.creditAmount);
      console.log("Total expense amount:", expenseTotalDebit);
    
    
    
      const  debitAmount = expenseTotalDebit + cgst.debitAmount  + sgst.debitAmount + igst.debitAmount +  vat.debitAmount;
      console.log("Total Debit Amount: ", debitAmount );
    
    
      //Expense
      savedExpense.expense.forEach((entry) => {
        const data = {
          organizationId: savedExpense.organizationId,
          operationId: savedExpense._id,
          transactionId: savedExpense.expenseNumber,
          date: savedExpense.createdDateTime,
          accountId: entry.expenseAccountId || undefined,
          action: "Expense",
          debitAmount: entry.amount || 0,
          creditAmount: 0,
          remark: entry.note,
        };
        createTrialEntry( data, createdDateTime )
      });
    
    
    
      //Tax
      if(savedExpense.cgst){
        createTrialEntry( cgst, createdDateTime )
      }
      if(savedExpense.sgst){
        createTrialEntry( sgst, createdDateTime )
      }
      if(savedExpense.igst){
        createTrialEntry( igst, createdDateTime )
      }
      if(savedExpense.vat){
        createTrialEntry( vat, createdDateTime )
      }
      if(savedExpense.paidThroughAccountId){
        createTrialEntry( paidThroughAccount, createdDateTime )
      }
    
    
    
      async function createTrialEntry( data, createdDateTime ) {
        const newTrialEntry = new TrialBalance({
            organizationId:data.organizationId,
            operationId:data.operationId,
            transactionId: data.transactionId,
            date:data.date,
            accountId: data.accountId,
            action: data.action,
            debitAmount: data.debitAmount || 0,
            creditAmount: data.creditAmount || 0,
            remark: data.remark,
            createdDateTime: createdDateTime
      });
      await newTrialEntry.save();
      console.log("newTrialEntry:",newTrialEntry);
      }     
    }