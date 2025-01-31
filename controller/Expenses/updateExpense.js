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




// Update Purchase Bill 
exports.updateBill = async (req, res) => {
    console.log("Update bill:", req.body);
  
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

      const { supplierId, paidThroughId, expense } = cleanedData;

      const expenseIds = expense.map(e => e.expenseAccountId);
    
      // Validate _id's
      const validateAllIds = validateIds({
        supplierId,
        paidThroughId,
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
      const { organizationExists, accountExist, supplierExist, existingPrefix } = await dataExist.dataExist( organizationId, supplierId );   
      
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
      if (!validation.validateOrganizationSupplierAccount( organizationExists, accountExist, supplierExist, supplierId, existingPrefix, res )) return;
        
      // Validate Inputs
      if (!validation.validateInputs(cleanedData, organizationExists, res)) return;
  
      // Tax Type 
      calculation.taxMode(cleanedData);

      // Calculate Expense 
      if (!calculation.calculateExpense( cleanedData, res )) return;

      const mongooseDocument = Expense.hydrate(existingExpense);
      Object.assign(mongooseDocument, cleanedData);
      const savedExpense = await mongooseDocument.save();

      if (!savedExpense) {
        return res.status(500).json({ message: "Failed to update expense" });
      }

      await createTrialBalance(savedExpense);
  
      res.status(200).json({ message: "Expense updated successfully", savedExpense });  
    } catch (error) {
      console.error("Error updating bill:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };







  function validateIds({ supplierId, paidThroughId, expenseIds, cleanedData }) {
      // Validate Supplier ID
      if (!mongoose.Types.ObjectId.isValid(supplierId) || supplierId.length !== 24) {
        return res.status(400).json({ message: `Invalid supplier ID: ${supplierId}` });
      }
    
      // Validate paidThrough Account ID if applicable
      if ((!mongoose.Types.ObjectId.isValid(paidThroughId) || paidThroughId.length !== 24) && cleanedData.paidThroughId !== undefined) {
        return "Select paidThrough account";
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






    async function createTrialBalance (savedExpense) {

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
            console.log(`Deleted existing TrialBalance entries for operationId: ${savedBill._id}`);
        }

        const { organizationId, paidThrough, paidThroughId, expenseDate, expense } = savedExpense;
    
        // Calculate the total credit amount by summing up the amount for all expense items
        const totalCreditAmount = expense.reduce((sum, expenseItem) => sum + parseFloat(expenseItem.amount), 0);
    
        // Create a single credit entry for the paidThrough account
        const creditEntry = new TrialBalance({
            organizationId,
            operationId: savedExpense._id,
            transactionId: savedExpense._id,
            date: expenseDate,
            accountId: paidThroughId,
            accountName: paidThrough,
            action: "Expense",
            creditAmount: totalCreditAmount,
            remark: "Total credit for expenses",
            createdDateTime: createdDateTime
        });
    
        await creditEntry.save();
        console.log("Credit Entry:", creditEntry);
    
        // Loop through each expense item to create individual debit entries
        for (const expenseItem of expense) {
            const { expenseAccountId, expenseAccount, note, amount } = expenseItem;
    
            // Create a debit entry for the expense account
            const debitEntry = new TrialBalance({
                organizationId,
                operationId: savedExpense._id,
                transactionId: savedExpense._id,
                date: expenseDate,
                accountId: expenseAccountId,
                accountName: expenseAccount,
                action: "Expense",
                debitAmount: parseFloat(amount),
                remark: note,
                createdDateTime: createdDateTime
            });
    
            await debitEntry.save();
            console.log("Debit Entry:", debitEntry);
        }
    }