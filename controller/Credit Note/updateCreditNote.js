
const mongoose = require('mongoose');
const CreditNote = require('../../database/model/creditNote');
const TrialBalance = require("../../database/model/trialBalance");
const ItemTrack = require("../../database/model/itemTrack");
const { dataExist, validation, calculation, accounts } = require("../Invoice/salesInvoice");
const { cleanData } = require("../../services/cleanData");




// Update Sales Invoice 
exports.updateInvoice = async (req, res) => {
    console.log("Update sales invoice:", req.body);
  
    try {
      const { organizationId, id: userId, userName } = req.user;
      const { invoiceId } = req.params;   
      
      // Check if the invoiceId exists in SalesReceipt schema
      const existingSalesReceipt = await SalesReceipt.findOne({
        organizationId,
        "invoice.invoiceId": invoiceId,
      });

      if (existingSalesReceipt) {
        console.log(`Invoice ID ${invoiceId} exists in SalesReceipt. Modification not allowed.`);
        return res.status(400).json({
          message: `This invoice is associated with a Sales Receipt and cannot be modified.`,
        });
      }

      // Fetch existing sales order
      const existingSalesInvoice = await SalesInvoice.findOne({ _id: invoiceId, organizationId });
      if (!existingSalesInvoice) {
        console.log("Sales invoice not found with ID:", invoiceId);
        return res.status(404).json({ message: "Sales invoice not found" });
      }

      // Clean input data
      const cleanedData = cleanData(req.body);

      const { items, customerId, otherExpenseAccountId, freightAccountId, depositAccountId } = cleanedData;

      const itemIds = items.map(item => item.itemId);
    
      // Validate _id's
      const validateAllIds = validateIds({
        customerId,
        otherExpenseAccountId,
        freightAccountId,
        depositAccountId,
        itemIds,
        cleanedData
      });
      if (validateAllIds) {
        return res.status(400).json({ message: validateAllIds });
      }

      // Fetch related data
      const { organizationExists, settings, customerExist ,existingPrefix, defaultAccount, customerAccount } = await dataExist.dataExist( organizationId, customerId );  
      
      // // Check if invoice editing is allowed
      // if (settings.invoiceEdit !== true) {
      //   return res.status(404).json({ message: "Editing sales invoices is not allowed in the current settings." });
      // } 
      
      const { itemTable } = await dataExist.itemDataExists( organizationId, items );
  
      //Data Exist Validation
      if (!validation.validateOrganizationTaxCurrency( organizationExists, customerExist, existingPrefix, defaultAccount, res )) return;
        
      // Validate Inputs
      if (!validation.validateInputs(cleanedData, settings, customerExist, items, itemTable, organizationExists, defaultAccount, res)) return;
  
      // Tax Type 
      calculation.taxType(cleanedData, customerExist, organizationExists);

      //Default Account
      const { defAcc, error } = await accounts.defaultAccounting( cleanedData, defaultAccount, organizationExists );
      if (error) { 
        res.status(400).json({ message: error }); 
        return false; 
      }
  
      // Calculate Sales Order
      if (!calculation.calculateSalesOrder(cleanedData, res)) return;

      //Sales Journal      
      if (!accounts.salesJournal( cleanedData, res )) return; 

      // Ensure salesInvoice fields match
      if (cleanedData.salesOrderNumber && cleanedData.salesOrderNumber !== existingSalesInvoice.salesOrderNumber) {
        return res.status(400).json({
          message: `The provided sales order number does not match the existing record. Expected: ${existingSalesInvoice.salesOrderNumber}`,
        });
      }
  
      // Ensure `salesInvoice` field matches the existing order
      if (cleanedData.salesInvoice !== existingSalesInvoice.salesInvoice) {
        return res.status(400).json({
          message: `The provided salesInvoice does not match the existing record. Expected: ${existingSalesInvoice.salesInvoice}`,
        });
      }

      const mongooseDocument = SalesInvoice.hydrate(existingSalesInvoice);
      Object.assign(mongooseDocument, cleanedData);
      const savedSalesInvoice = await mongooseDocument.save();

      if (!savedSalesInvoice) {
        return res.status(500).json({ message: "Failed to update sales invoice" });
      }

      //Journal
      await journal( savedSalesInvoice, defAcc, customerAccount );
      
      //Item Track
      await itemTrack( savedSalesInvoice, itemTable, organizationId, invoiceId );
  
      res.status(200).json({ message: "Sale invoice updated successfully", savedSalesInvoice });
      // console.log("Sale invoice updated successfully:", savedSalesInvoice);
  
    } catch (error) {
      console.error("Error updating sale invoice:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };






  function validateIds({ customerId, otherExpenseAccountId, freightAccountId, depositAccountId, itemIds, cleanedData }) {
    // Validate Customer ID
    if (!mongoose.Types.ObjectId.isValid(customerId) || customerId.length !== 24) {
      return `Invalid Customer ID: ${customerId}`;
    }
  
    // Validate Other Expense Account ID if applicable
    if ((!mongoose.Types.ObjectId.isValid(otherExpenseAccountId) || otherExpenseAccountId.length !== 24) && cleanedData.otherExpenseAmount !== undefined) {
      return "Select other expense account";
    }
  
    // Validate Freight Account ID if applicable
    if ((!mongoose.Types.ObjectId.isValid(freightAccountId) || freightAccountId.length !== 24) && cleanedData.freightAmount !== undefined) {
      return "Select freight account";
    }
  
    // Validate Deposit Account ID if applicable
    if ((!mongoose.Types.ObjectId.isValid(depositAccountId) || depositAccountId.length !== 24) && cleanedData.paidAmount !== undefined) {
      return "Select deposit account";
    }
  
    // Validate Item IDs
    const invalidItemIds = itemIds.filter(itemId => !mongoose.Types.ObjectId.isValid(itemId) || itemId.length !== 24);
    if (invalidItemIds.length > 0) {
      return `Invalid item IDs: ${invalidItemIds.join(', ')}`;
    }
  
    // Check for duplicate Item IDs
    const uniqueItemIds = new Set(itemIds);
    if (uniqueItemIds.size !== itemIds.length) {
      return "Duplicate Item found in the list.";
    }
  
    // Return null if all validations pass
    return null;
  }
  




  

  // Item Track Function
  async function itemTrack(savedInvoice, itemTable, organizationId, invoiceId) {

    // Fetch existing itemTrack entries
    const existingItemTracks = await ItemTrack.find({ organizationId, operationId: invoiceId });
    
    const createdDateTime = existingItemTracks[0] ? existingItemTracks[0].createdDateTime : null; 

      const { items } = savedInvoice;

      for (const item of items) {

        const itemIdAsObjectId = new mongoose.Types.ObjectId(item.itemId);

        // Find the matching item
        const matchingItem = itemTable.find((entry) => entry._id.equals(itemIdAsObjectId));

        if (!matchingItem) {
          console.error(`Item with ID ${item.itemId} not found in itemTable`);
          continue; 
        }

        // const newStock = matchingItem.currentStock - item.quantity;
        // if (newStock < 0) {
        //   console.error(`Insufficient stock for item ${item.itemName}`);
        //   continue; 
        // }

        const newItemTrack = new ItemTrack({
          organizationId: savedInvoice.organizationId,
          operationId: savedInvoice._id,
          transactionId: savedInvoice.salesInvoice,
          action: "Sale",
          itemId: matchingItem._id,
          sellingPrice: matchingItem.sellingPrice || 0,
          costPrice: matchingItem.costPrice || 0, 
          creditQuantity: item.quantity, 
          createdDateTime: createdDateTime // Preserve the original createdDateTime
        });

        const savedItemTrack = await newItemTrack.save();
        // console.log("savedItemTrack",savedItemTrack);

        // Delete existing itemTrack entries for the operation
      if (existingItemTracks.length > 0) {
        await ItemTrack.deleteMany({ organizationId, operationId: invoiceId });
        console.log(`Deleted existing itemTrack entries for operationId: ${invoiceId}`);
      }
    }
  }









  async function journal( savedInvoice, defAcc, customerAccount ) { 
    
    // Fetch existing TrialBalance's createdDateTime
    const existingTrialBalance = await TrialBalance.findOne({
      organizationId: savedInvoice.organizationId,
      operationId: savedInvoice._id,
    });  

    const createdDateTime = existingTrialBalance ? existingTrialBalance.createdDateTime : null;

    // If there are existing entries, delete them
    if (existingTrialBalance) {
      await TrialBalance.deleteMany({
        organizationId: savedInvoice.organizationId,
        operationId: savedInvoice._id,
        // createdDateTime: createdDateTime,  // Delete only entries with the same createdDateTime
      });
      console.log(`Deleted existing TrialBalance entries for operationId: ${savedInvoice._id}`);
    }
    
    const discount = {
      organizationId: savedInvoice.organizationId,
      operationId: savedInvoice._id,
      transactionId: savedInvoice.salesInvoice,
      date: savedInvoice.createdDate,
      accountId: defAcc.salesDiscountAccount || undefined,
      action: "Sales Invoice",
      debitAmount: savedInvoice.totalDiscount || 0,
      creditAmount: 0,
      remark: savedInvoice.note,
    };
    // const sale = {
    //   organizationId: savedInvoice.organizationId,
    //   operationId: savedInvoice._id,
    //   transactionId: savedInvoice.salesInvoice,
    //   date: savedInvoice.createdDate,
    //   accountId: defAcc.salesAccount || undefined,
    //   action: "Sales Invoice",
    //   debitAmount: 0,
    //   creditAmount: savedInvoice.saleAmount,
    //   remark: savedInvoice.note,
    // };
    const cgst = {
      organizationId: savedInvoice.organizationId,
      operationId: savedInvoice._id,
      transactionId: savedInvoice.salesInvoice,
      date: savedInvoice.createdDate,
      accountId: defAcc.outputCgst || undefined,
      action: "Sales Invoice",
      debitAmount: 0,
      creditAmount: savedInvoice.cgst || 0,
      remark: savedInvoice.note,
    };
    const sgst = {
      organizationId: savedInvoice.organizationId,
      operationId: savedInvoice._id,
      transactionId: savedInvoice.salesInvoice,
      date: savedInvoice.createdDate,
      accountId: defAcc.outputSgst || undefined,
      action: "Sales Invoice",
      debitAmount: 0,
      creditAmount: savedInvoice.sgst || 0,
      remark: savedInvoice.note,
    };
    const igst = {
      organizationId: savedInvoice.organizationId,
      operationId: savedInvoice._id,
      transactionId: savedInvoice.salesInvoice,
      date: savedInvoice.createdDate,
      accountId: defAcc.outputIgst || undefined,
      action: "Sales Invoice",
      debitAmount: 0,
      creditAmount: savedInvoice.igst || 0,
      remark: savedInvoice.note,
    };
    const vat = {
      organizationId: savedInvoice.organizationId,
      operationId: savedInvoice._id,
      transactionId: savedInvoice.salesInvoice,
      date: savedInvoice.createdDate,
      accountId: defAcc.outputVat || undefined,
      action: "Sales Invoice",
      debitAmount: 0,
      creditAmount: savedInvoice.vat || 0,
      remark: savedInvoice.note,
    };
    const customer = {
      organizationId: savedInvoice.organizationId,
      operationId: savedInvoice._id,
      transactionId: savedInvoice.salesInvoice,
      date: savedInvoice.createdDate,
      accountId: customerAccount._id || undefined,
      action: "Sales Invoice",
      debitAmount: savedInvoice.totalAmount || 0,
      creditAmount: 0,
      remark: savedInvoice.note,
    };
    const customerPaid = {
      organizationId: savedInvoice.organizationId,
      operationId: savedInvoice._id,
      transactionId: savedInvoice.salesInvoice,
      date: savedInvoice.createdDate,
      accountId: customerAccount._id || undefined,
      action: "Receipt",
      debitAmount: 0,
      creditAmount: savedInvoice.paidAmount || 0,
      remark: savedInvoice.note,
    };
    const depositAccount = {
      organizationId: savedInvoice.organizationId,
      operationId: savedInvoice._id,
      transactionId: savedInvoice.salesInvoice,
      date: savedInvoice.createdDate,
      accountId: defAcc.depositAccountId || undefined,
      action: "Receipt",
      debitAmount: savedInvoice.paidAmount || 0,
      creditAmount: 0,
      remark: savedInvoice.note,
    };
    const otherExpense = {
      organizationId: savedInvoice.organizationId,
      operationId: savedInvoice._id,
      transactionId: savedInvoice.salesInvoice,
      date: savedInvoice.createdDate,
      accountId: defAcc.otherExpenseAccountId || undefined,
      action: "Sales Invoice",
      debitAmount: 0,
      creditAmount: savedInvoice.otherExpenseAmount || 0,
      remark: savedInvoice.note,
    };
    const freight = {
      organizationId: savedInvoice.organizationId,
      operationId: savedInvoice._id,
      transactionId: savedInvoice.salesInvoice,
      date: savedInvoice.createdDate,
      accountId: defAcc.freightAccountId || undefined,
      action: "Sales Invoice",
      debitAmount: 0,
      creditAmount: savedInvoice.freightAmount || 0,
      remark: savedInvoice.note,
    };
    const roundOff = {
      organizationId: savedInvoice.organizationId,
      operationId: savedInvoice._id,
      transactionId: savedInvoice.salesInvoice,
      date: savedInvoice.createdDate,
      accountName: "Round Off",
      action: "Sales Invoice",
      debitAmount: savedInvoice.roundOffAmount || 0,
      creditAmount: 0,
      remark: savedInvoice.note,
    };

    let salesTotalDebit = 0;
    let salesTotalCredit = 0;

    if (Array.isArray(savedInvoice.salesJournal)) {
      savedInvoice.salesJournal.forEach((entry) => {

        console.log( "Account Log",entry.accountId, entry.debitAmount, entry.creditAmount );      

        salesTotalDebit += entry.debitAmount || 0;
        salesTotalCredit += entry.creditAmount || 0;

      });

      console.log("Total Debit Amount from saleJournal:", salesTotalDebit);
      console.log("Total Credit Amount from saleJournal:", salesTotalCredit);
    } else {
      console.error("SaleJournal is not an array or is undefined.");
    }
    


    console.log("cgst", cgst.debitAmount,  cgst.creditAmount);
    console.log("sgst", sgst.debitAmount,  sgst.creditAmount);
    console.log("igst", igst.debitAmount,  igst.creditAmount);
    console.log("vat", vat.debitAmount,  vat.creditAmount);

    console.log("customer", customer.debitAmount,  customer.creditAmount);
    console.log("discount", discount.debitAmount,  discount.creditAmount);

    
    console.log("otherExpense", otherExpense.debitAmount,  otherExpense.creditAmount);
    console.log("freight", freight.debitAmount,  freight.creditAmount);
    console.log("roundOff", roundOff.debitAmount,  roundOff.creditAmount);

    console.log("customerPaid", customerPaid.debitAmount,  customerPaid.creditAmount);
    console.log("depositAccount", depositAccount.debitAmount,  depositAccount.creditAmount);

    const  debitAmount = salesTotalDebit + cgst.debitAmount  + sgst.debitAmount + igst.debitAmount +  vat.debitAmount + customer.debitAmount + discount.debitAmount + otherExpense.debitAmount + freight.debitAmount + roundOff.debitAmount + customerPaid.debitAmount + depositAccount.debitAmount ;
    const  creditAmount = salesTotalCredit + cgst.creditAmount  + sgst.creditAmount + igst.creditAmount +  vat.creditAmount + customer.creditAmount + discount.creditAmount + otherExpense.creditAmount + freight.creditAmount + roundOff.creditAmount + customerPaid.creditAmount + depositAccount.creditAmount ;

    console.log("Total Debit Amount: ", debitAmount );
    console.log("Total Credit Amount: ", creditAmount );

    // console.log( discount, sale, cgst, sgst, igst, vat, customer, otherExpense, freight, roundOff );


    //Sales
      savedInvoice.salesJournal.forEach((entry) => {

        const data = {
          organizationId: savedInvoice.organizationId,
          operationId: savedInvoice._id,
          transactionId: savedInvoice.salesInvoice,
          date: savedInvoice.createdDateTime,
          accountId: entry.accountId || undefined,
          action: "Sales Invoice1",
          debitAmount: 0,
          creditAmount: entry.creditAmount || 0,
          remark: savedInvoice.note,
        };
        // console.log("data", data, entry.accountId);
        createTrialEntry( data, createdDateTime )

      });

      
  



    //Tax
    if(savedInvoice.cgst){
      createTrialEntry( cgst, createdDateTime )
    }
    if(savedInvoice.sgst){
      createTrialEntry( sgst, createdDateTime )
    }
    if(savedInvoice.igst){
      createTrialEntry( igst, createdDateTime )
    }
    if(savedInvoice.vat){
      createTrialEntry( vat, createdDateTime )
    }

    //Discount  
    if(savedInvoice.totalDiscount){
      createTrialEntry( discount, createdDateTime )
    }

    //Other Expense
    if(savedInvoice.otherExpenseAmount){
      createTrialEntry( otherExpense, createdDateTime )
    }

    //Freight
    if(savedInvoice.freightAmount){
      createTrialEntry( freight, createdDateTime )
    }
    
    //Round Off
    if(savedInvoice.roundOffAmount){
      createTrialEntry( roundOff, createdDateTime )
    }
  
    //Customer
    createTrialEntry( customer, createdDateTime )
    
    //Paid
    if(savedInvoice.paidAmount){
      createTrialEntry( customerPaid, createdDateTime )
      createTrialEntry( depositAccount, createdDateTime )
    }
  }





  async function createTrialEntry( data, createdDateTime ) {
    const newTrialEntry = new TrialBalance({
        organizationId:data.organizationId,
        operationId:data.operationId,
        transactionId: data.transactionId,
        date:data.date,
        accountId: data.accountId,
        action: data.action,
        debitAmount: data.debitAmount,
        creditAmount: data.creditAmount,
        remark: data.remark,
        createdDateTime: createdDateTime
    });
    
    await newTrialEntry.save();
  }