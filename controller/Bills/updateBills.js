
const mongoose = require('mongoose');
const Bills = require('../../database/model/bills');
const PaymentMade = require('../../database/model/paymentMade');
const TrialBalance = require("../../database/model/trialBalance");
const ItemTrack = require("../../database/model/itemTrack");
const { dataExist, validation, calculation, accounts } = require("../Bills/billsController");
const { cleanData } = require("../../services/cleanData");




// Update Purchase Bill 
exports.updateBill = async (req, res) => {
    console.log("Update bill:", req.body);
  
    try {
      const { organizationId } = req.user;
      const { billId } = req.params;   
      
      // Check if the billId exists in PaymentMade schema
      const existingPaymentMade = await PaymentMade.findOne({
        organizationId,
        "unpaidBills.billId": billId,
      });

      if (existingPaymentMade) {
        console.log(`Bill ID ${billId} exists in PaymentMade. Modification not allowed.`);
        return res.status(400).json({
          message: `This bill is associated with a Payment Made and cannot be modified.`,
        });
      }

      // Fetch existing bill
      const existingBill = await Bills.findOne({ _id: billId, organizationId });
      if (!existingBill) {
        console.log("Bill not found with ID:", billId);
        return res.status(404).json({ message: "Bill not found" });
      }

      // Clean input data
      const cleanedData = cleanData(req.body);

      const { items, supplierId, supplierDisplayName, purchaseOrderId, otherExpenseAccountId, freightAccountId, paidAccountId } = cleanedData;

      const itemIds = items.map(item => item.itemId);
    
      // Validate _id's
      const validateAllIds = validateIds({
        supplierId,
        otherExpenseAccountId,
        freightAccountId,
        paidAccountId,
        purchaseOrderId,
        itemIds,
        cleanedData
      });
      if (validateAllIds) {
        return res.status(400).json({ message: validateAllIds });
      }

      // Ensure purchase order fields match
      if (cleanedData.orderNumber && cleanedData.orderNumber !== existingBill.orderNumber) {
        return res.status(400).json({
          message: `The provided order number does not match the existing record. Expected: ${existingBill.orderNumber}`,
        });
      }
  
      // Ensure `billNumber` field matches the existing bill
      if (cleanedData.billNumber !== existingBill.billNumber) {
        return res.status(400).json({
          message: `The provided billNumber does not match the existing record. Expected: ${existingBill.billNumber}`,
        });
      }

      // Fetch related data
      const { organizationExists, supplierExist, purchaseOrderExist, taxExists, existingPrefix, settings, defaultAccount, supplierAccount } = await dataExist.dataExist( organizationId, supplierId, supplierDisplayName, purchaseOrderId );  
      
      // // Check if bill editing is allowed
      // if (settings.billEdit !== true) {
      //   return res.status(404).json({ message: "Editing bill is not allowed in the current settings." });
      // } 
      
      const { itemTable } = await dataExist.itemDataExists( organizationId, items );
  
      //Data Exist Validation
      if (!validation.validateOrganizationSupplierOrder( purchaseOrderId, organizationExists, supplierExist, purchaseOrderExist, existingPrefix, defaultAccount, res )) return;
        
      // Validate Inputs
      if (!validation.validateInputs(cleanedData, supplierExist, purchaseOrderExist, items, itemTable, organizationExists, defaultAccount, res)) return;
  
      // Tax Type 
      calculation.taxType(cleanedData, supplierExist);

      //Default Account
      const { defAcc, error } = await accounts.defaultAccounting( cleanedData, defaultAccount, organizationExists );
      if (error) { 
        res.status(400).json({ message: error }); 
        return false; 
      }
  
      // Calculate Sales Order
      if (!calculation.calculateBills(cleanedData, itemTable, res)) return;

      //Sales Journal      
      if (!accounts.salesJournal( cleanedData, res )) return; 

      const mongooseDocument = Bills.hydrate(existingBill);
      Object.assign(mongooseDocument, cleanedData);
      const savedBill = await mongooseDocument.save();

      if (!savedBill) {
        return res.status(500).json({ message: "Failed to update bill" });
      }

      //Journal
      await journal( savedBill, defAcc, supplierAccount );
      
      //Item Track
      await itemTrack( savedBill, itemTable, organizationId, billId );
  
      res.status(200).json({ message: "Bill updated successfully", savedBill });
      // console.log("Bill updated successfully:", savedBill);
  
    } catch (error) {
      console.error("Error updating bill:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };






  function validateIds({ supplierId, otherExpenseAccountId, freightAccountId, paidAccountId, purchaseOrderId, itemIds, cleanedData }) {
    // Validate Supplier ID
    if (!mongoose.Types.ObjectId.isValid(supplierId) || supplierId.length !== 24) {
      return res.status(400).json({ message: `Invalid supplier ID: ${supplierId}` });
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
    if ((!mongoose.Types.ObjectId.isValid(paidAccountId) || paidAccountId.length !== 24) && cleanedData.paidAccountId !== undefined) {
      return "Select deposit account";
    }

    if (purchaseOrderId) {
      if (!mongoose.Types.ObjectId.isValid(purchaseOrderId) || purchaseOrderId.length !== 24) {
        return res.status(400).json({ message: `Invalid Purchase Order ID: ${purchaseOrderId}` });
      }
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
  async function itemTrack(savedBill, itemTable, organizationId, billId) {

    // Fetch existing itemTrack entries
    const existingItemTracks = await ItemTrack.find({ organizationId, operationId: billId });
    
    const createdDateTime = existingItemTracks[0] ? existingItemTracks[0].createdDateTime : null; 

      const { items } = savedBill;

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

        await newItemTrack.save();

        // Delete existing itemTrack entries for the operation
      if (existingItemTracks.length > 0) {
        await ItemTrack.deleteMany({ organizationId, operationId: billId });
        console.log(`Deleted existing itemTrack entries for operationId: ${billId}`);
      }
    }
  }









  async function journal( savedBill, defAcc, supplierAccount ) { 
    
    // Fetch existing TrialBalance's createdDateTime
    const existingTrialBalance = await TrialBalance.findOne({
      organizationId: savedBill.organizationId,
      operationId: savedBill._id,
    });  

    const createdDateTime = existingTrialBalance ? existingTrialBalance.createdDateTime : null;

    // If there are existing entries, delete them
    if (existingTrialBalance) {
      await TrialBalance.deleteMany({
        organizationId: savedBill.organizationId,
        operationId: savedBill._id,
        // createdDateTime: createdDateTime,  // Delete only entries with the same createdDateTime
      });
      console.log(`Deleted existing TrialBalance entries for operationId: ${savedBill._id}`);
    }
    
    const discount = {
      organizationId: savedBills.organizationId,
      operationId: savedBills._id,
      transactionId: savedBills.billNumber,
      date: savedBills.createdDate,
      accountId: defAcc.purchaseDiscountAccount || undefined,
      action: "Purchase Bill",
      debitAmount: 0,
      creditAmount: savedBills.totalDiscount || 0,
      remark: savedBills.note,
    };
    // const purchase = {
    //   organizationId: savedBills.organizationId,
    //   operationId: savedBills._id,
    //   transactionId: savedBills.billNumber,
    //   date: savedBills.createdDate,
    //   accountId: defAcc.purchaseAccount || undefined,
    //   accountName: defAcc.purchaseAccountName || undefined,
    //   action: "Purchase Bill",
    //   debitAmount: savedBills.purchaseAmount,
    //   creditAmount: 0,
    //   remark: savedBills.note,
    // };
    const cgst = {
      organizationId: savedBills.organizationId,
      operationId: savedBills._id,
      transactionId: savedBills.billNumber,
      date: savedBills.createdDate,
      accountId: defAcc.inputCgst || undefined,
      action: "Purchase Bill",
      debitAmount: savedBills.cgst || 0,
      creditAmount: 0,
      remark: savedBills.note,
    };
    const sgst = {
      organizationId: savedBills.organizationId,
      operationId: savedBills._id,
      transactionId: savedBills.billNumber,
      date: savedBills.createdDate,
      accountId: defAcc.inputSgst || undefined,
      action: "Purchase Bill",
      debitAmount: savedBills.sgst || 0,
      creditAmount: 0,
      remark: savedBills.note,
    };
    const igst = {
      organizationId: savedBills.organizationId,
      operationId: savedBills._id,
      transactionId: savedBills.billNumber,
      date: savedBills.createdDate,
      accountId: defAcc.inputIgst || undefined,
      action: "Purchase Bill",
      debitAmount: savedBills.igst || 0,
      creditAmount: 0,
      remark: savedBills.note,
    };
    const vat = {
      organizationId: savedBills.organizationId,
      operationId: savedBills._id,
      transactionId: savedBills.billNumber,
      date: savedBills.createdDate,
      accountId: defAcc.inputVat || undefined,
      action: "Purchase Bill",
      debitAmount: savedBills.vat || 0,
      creditAmount: 0,
      remark: savedBills.note,
    };
    const supplier = {
      organizationId: savedBills.organizationId,
      operationId: savedBills._id,
      transactionId: savedBills.billNumber,
      date: savedBills.createdDate,
      accountId: supplierAccount._id || undefined,
      action: "Purchase Bill",
      debitAmount: 0,
      creditAmount: savedBills.grandTotal || 0,
      remark: savedBills.note,
    };
    const supplierPaid = {
      organizationId: savedBills.organizationId,
      operationId: savedBills._id,
      transactionId: savedBills.billNumber,
      date: savedBills.createdDate,
      accountId: supplierAccount._id || undefined,
      action: "Payment",
      debitAmount: savedBills.paidAmount || 0,
      creditAmount: 0,
      remark: savedBills.note,
    };
    const paidAccount = {
      organizationId: savedBills.organizationId,
      operationId: savedBills._id,
      transactionId: savedBills.billNumber,
      date: savedBills.createdDate,
      accountId: defAcc.paidAccountId || undefined,
      action: "Payment",
      debitAmount: 0,
      creditAmount: savedBills.paidAmount || 0,
      remark: savedBills.note,
    };
    const otherExpense = {
      organizationId: savedBills.organizationId,
      operationId: savedBills._id,
      transactionId: savedBills.billNumber,
      date: savedBills.createdDate,
      accountId: defAcc.otherExpenseAccountId || undefined,
      action: "Purchase Bill",
      debitAmount: savedBills.otherExpenseAmount || 0,
      creditAmount: 0,
      remark: savedBills.note,
    };
    const freight = {
      organizationId: savedBills.organizationId,
      operationId: savedBills._id,
      transactionId: savedBills.billNumber,
      date: savedBills.createdDate,
      accountId: defAcc.freightAccountId || undefined,
      action: "Purchase Bill",
      debitAmount: savedBills.freightAmount || 0,
      creditAmount: 0,
      remark: savedBills.note,
    };
    const roundOff = {
      organizationId: savedBills.organizationId,
      operationId: savedBills._id,
      transactionId: savedBills.billNumber,
      date: savedBills.createdDate,
      accountName: "Round Off",
      action: "Purchase Bill",
      debitAmount: 0,
      creditAmount: savedBills.roundOffAmount || 0,
      remark: savedBills.note,
    };

    let purchaseTotalDebit = 0;
    let purchaseTotalCredit = 0;

    if (Array.isArray(savedBills.salesJournal)) {
      savedBills.salesJournal.forEach((entry) => {
  
        console.log( "Account Log",entry.accountId, entry.debitAmount, entry.creditAmount );      
  
        purchaseTotalDebit += entry.debitAmount || 0;
        purchaseTotalCredit += entry.creditAmount || 0;
  
      });
  
      console.log("Total Debit Amount from savedBills:", purchaseTotalDebit);
      console.log("Total Credit Amount from savedBills:", purchaseTotalCredit);
    } else {
      console.error("SavedBills is not an array or is undefined.");
    }
    

    console.log("cgst", cgst.debitAmount,  cgst.creditAmount);
  console.log("sgst", sgst.debitAmount,  sgst.creditAmount);
  console.log("igst", igst.debitAmount,  igst.creditAmount);
  console.log("vat", vat.debitAmount,  vat.creditAmount);

  // console.log("purchase", purchase.debitAmount,  purchase.creditAmount);
  console.log("supplier", supplier.debitAmount,  supplier.creditAmount);
  console.log("discount", discount.debitAmount,  discount.creditAmount);

  
  console.log("otherExpense", otherExpense.debitAmount,  otherExpense.creditAmount);
  console.log("freight", freight.debitAmount,  freight.creditAmount);
  console.log("roundOff", roundOff.debitAmount,  roundOff.creditAmount);

  console.log("supplierPaid", supplierPaid.debitAmount,  supplierPaid.creditAmount);
  console.log("paidAccount", paidAccount.debitAmount,  paidAccount.creditAmount);

  // const  debitAmount = cgst.debitAmount  + sgst.debitAmount + igst.debitAmount +  vat.debitAmount + purchase.debitAmount + supplier.debitAmount + discount.debitAmount + otherExpense.debitAmount + freight.debitAmount + roundOff.debitAmount + supplierPaid.debitAmount + paidAccount.debitAmount ;
  // const  creditAmount = cgst.creditAmount  + sgst.creditAmount + igst.creditAmount +  vat.creditAmount + purchase.creditAmount + supplier.creditAmount + discount.creditAmount + otherExpense.creditAmount + freight.creditAmount + roundOff.creditAmount + supplierPaid.creditAmount + paidAccount.creditAmount ;
  const debitAmount = 
    cgst.debitAmount  + 
    sgst.debitAmount  + 
    igst.debitAmount  + 
    vat.debitAmount  + 
    purchaseTotalDebit + 
    supplier.debitAmount  + 
    discount.debitAmount  + 
    otherExpense.debitAmount  + 
    freight.debitAmount  + 
    roundOff.debitAmount  + 
    supplierPaid.debitAmount  + 
    paidAccount.debitAmount ;

  const creditAmount = 
    cgst.creditAmount  + 
    sgst.creditAmount  + 
    igst.creditAmount  + 
    vat.creditAmount  + 
    purchaseTotalCredit  + 
    supplier.creditAmount  + 
    discount.creditAmount  + 
    otherExpense.creditAmount  + 
    freight.creditAmount  + 
    roundOff.creditAmount  + 
    supplierPaid.creditAmount  + 
    paidAccount.creditAmount ;

    console.log("Total Debit Amount: ", debitAmount );
    console.log("Total Credit Amount: ", creditAmount );

    // console.log( discount, sale, cgst, sgst, igst, vat, customer, otherExpense, freight, roundOff );


    //Sales
    savedBills.purchaseJournal.forEach((entry) => {
      const data = {
        organizationId: savedBills.organizationId,
        operationId: savedBills._id,
        transactionId: savedBills.billNumber,
        date: savedBills.createdDateTime,
        accountId: entry.accountId || undefined,
        action: "Purchase Bill",
        debitAmount: entry.debitAmount || 0,
        creditAmount: 0,
        remark: savedBills.note,
      };
      createTrialEntry( data, createdDateTime )
    });

      
  



    // createTrialEntry( purchase )

  //Tax
  if(savedBills.cgst){
    createTrialEntry( cgst, createdDateTime )
  }
  if(savedBills.sgst){
    createTrialEntry( sgst, createdDateTime )
  }
  if(savedBills.igst){
    createTrialEntry( igst, createdDateTime )
  }
  if(savedBills.vat){
    createTrialEntry( vat, createdDateTime )
  }

  //Discount  
  if(savedBills.totalDiscount){
    createTrialEntry( discount, createdDateTime )
  }

  //Other Expense
  if(savedBills.otherExpenseAmount){
    createTrialEntry( otherExpense, createdDateTime )
  }

  //Freight
  if(savedBills.freightAmount){
    createTrialEntry( freight, createdDateTime )
  }
  
  //Round Off
  if(savedBills.roundOffAmount){
    createTrialEntry( roundOff, createdDateTime )
  }
 
  //supplier
  createTrialEntry( supplier, createdDateTime )
  
  //Paid
  if(savedBills.paidAmount){
    createTrialEntry( supplierPaid, createdDateTime )
    createTrialEntry( paidAccount, createdDateTime )
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
      debitAmount: data.debitAmount || 0,
      creditAmount: data.creditAmount || 0,
      remark: data.remark,
      createdDateTime: createdDateTime
    });
    
    await newTrialEntry.save();
  }