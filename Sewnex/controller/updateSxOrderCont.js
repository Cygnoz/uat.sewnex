const Organization = require("../../database/model/organization");
const Customer = require("../../database/model/customer");
const Settings = require("../../database/model/settings");
const Prefix = require("../../database/model/prefix");
const DefAcc = require("../../database/model/defaultAccount");
const Account = require("../../database/model/account");
const TrialBalance = require("../../database/model/trialBalance");
const Item = require("../../database/model/item");

const SewnexOrder = require("../model/sxOrder");
const Service = require("../model/service");
const SewnexOrderService = require("../model/sxOrderService");
const CPS = require("../model/cps");

const { dataExist, validation, prefix, calculation, accounts } = require("../controller/sxOrderCont");

const { cleanData } = require("../../services/cleanData");

const mongoose = require('mongoose');
const moment = require("moment-timezone");




// Edit Sewnex Order
exports.editOrder = async (req, res) => {
    console.log("Edit Order", req.body);
    
    try {
        const { organizationId, id: userId } = req.user;
        const { orderId } = req.params; 
        
        // Fetch existing order
        const existingOrder = await SewnexOrder.findOne({ _id: orderId, organizationId });
        if (!existingOrder) {
            console.log("Order not found with ID:", orderId);
            return res.status(404).json({ message: "Order not found!" });
        }

        const cleanedData = cleanData(req.body);

        // Ensure `prefix:salesOrder` field matches the existing order
        if (cleanedData.salesOrder !== existingOrder.salesOrder) {
            return res.status(400).json({
            message: `The provided prefix does not match the existing record. Expected: ${existingOrder.salesOrder}`,
            });
        }
        
        cleanedData.service = cleanedData.service
        ?.map(data => cleanData(data))
        .filter(service => service.serviceId !== undefined && service.serviceId !== '') || [];
        
        const { customerId, service } = cleanedData;
        
        const serviceIds = service.map(service => service.serviceId);

        // Check for duplicate itemIds
        // const uniqueItemIds = new Set(serviceIds);
        // if (uniqueItemIds.size !== serviceIds.length) {
        //   return res.status(400).json({ message: "Duplicate service found" });
        // }        

        // Validate serviceIds
        const invalidServiceIds = serviceIds.filter(serviceId => !mongoose.Types.ObjectId.isValid(serviceId) || serviceId.length !== 24);
        if (invalidServiceIds.length > 0) {
          return res.status(400).json({ message: `Invalid service IDs: ${invalidServiceIds.join(', ')}` });
        } 


        const { organizationExists, customerExist, existingPrefix, defaultAccount, services, allFabrics, allStyle, allParameter, customerAccount } = await dataExist.dataExist(organizationId, customerId, serviceIds);

        const allData = { allParameter, allFabrics, allStyle, services };
        
        if (!validation.validateOrganizationTaxCurrency( organizationExists, customerExist, existingPrefix, defaultAccount, res )) return;
        
        //Validate Inputs
        if (!validation.validateInputs( cleanedData, customerExist, defaultAccount, allData, res)) return;

         //Tax Type
         calculation.taxType(cleanedData, customerExist, organizationExists );

        //Default Account
        const { defAcc, error } = await accounts.defaultAccounting( cleanedData, defaultAccount, organizationExists );
        if (error) { 
          res.status(400).json({ message: error }); 
          return false; 
        }

        // Calculate Sales 
        if (!calculation.calculateSalesOrder( cleanedData, res )) return;

        //Sales Journal      
        if (!accounts.salesJournal( cleanedData, res )) return;     

        cleanedData.createdDateTime = moment.tz(cleanedData.saleOrderDate, "YYYY-MM-DDTHH:mm:ss.SSS[Z]", organizationExists.timeZoneExp).toISOString();    
        
        // **Step 1: Delete existing orderServiceId(s) from SewnexOrderService**
        await SewnexOrderService.deleteMany({ _id: { $in: existingOrder.service.map(s => s.orderServiceId) } });
        
        // **Step 2: Create new orderServiceId(s)**
        const orderServices = await Promise.all(service.map(async (serviceItem) => {
            await prefix.salesOrderServicePrefix(serviceItem,existingPrefix);
            const newOrderService = new SewnexOrderService({
                ...serviceItem,
                organizationId,
                createdDateTime: cleanedData.createdDateTime // Pass new createdDateTime
            });
            return await newOrderService.save();
        }));

        existingPrefix.save();

        // **Step 3: Assign new orderServiceIds to cleanedData.service**
        cleanedData.service = orderServices.map(service => ({
            orderServiceId: service._id,
        }));

        // **Step 4: Update Order**
        const mongooseDocument = SewnexOrder.hydrate(existingOrder);
        Object.assign(mongooseDocument, cleanedData);
        const savedOrder = await mongooseDocument.save();
        if (!savedOrder) {
            return res.status(500).json({ message: "Failed to update order" });
        }

        //Journal
        await journal( savedOrder, defAcc, customerAccount );

        console.log( "Update Order successfully:", savedOrder );

        res.status(201).json({
            message: "Update Order successfully",
            data: savedOrder
        });

    } catch (error) {
        console.error("Error Updating Order:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};




// Delete Order
exports.deleteOrder = async (req, res) => {
    console.log("Delete order request received:", req.params);

    try {
        const { organizationId, id: userId } = req.user;
        const { orderId } = req.params;

        // Validate orderId
        if (!mongoose.Types.ObjectId.isValid(orderId) || orderId.length !== 24) {
            return res.status(400).json({ message: `Invalid Order ID: ${orderId}` });
        }

        // Fetch existing order
        const existingOrder = await SewnexOrder.findOne({ _id: orderId, organizationId });
        if (!existingOrder) {
            console.log("Order not found with ID:", orderId);
            return res.status(404).json({ message: "Order not found!" });
        }

        // Delete associated order services
        const deleteServicesResult = await SewnexOrderService.deleteMany({ 
            _id: { $in: existingOrder.service.map(s => s.orderServiceId) } 
        });

        console.log(`Deleted ${deleteServicesResult.deletedCount} related order services.`);

        // Fetch existing TrialBalance's createdDateTime
        const existingTrialBalance = await TrialBalance.findOne({
            organizationId: existingOrder.organizationId,
            operationId: existingOrder._id,
          });  
          // If there are existing entries, delete them
          if (existingTrialBalance) {
            await TrialBalance.deleteMany({
              organizationId: existingOrder.organizationId,
              operationId: existingOrder._id,
            });
            console.log(`Deleted existing TrialBalance entries for operationId: ${existingOrder._id}`);
          }

        // Delete the order
        const deletedOrder = await existingOrder.deleteOne();
        if (!deletedOrder) {
            console.error("Failed to delete order.");
            return res.status(500).json({ message: "Failed to delete order" });
        }
    
        res.status(200).json({ message: "Order deleted successfully" });
        console.log("Order deleted successfully with ID:", orderId);

    } catch (error) {
        console.error("Error deleting order:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};














async function journal( savedOrder, defAcc, customerAccount ) {  

    await TrialBalance.deleteMany({
        organizationId: savedOrder.organizationId,
        operationId: savedOrder._id,
    });

    const discount = {
      organizationId: savedOrder.organizationId,
      operationId: savedOrder._id,
      transactionId: savedOrder.salesOrder,
      date: savedOrder.createdDate,
      accountId: defAcc.salesDiscountAccount || undefined,
      action: "Sales Invoice",
      debitAmount: savedOrder.totalDiscount || 0,
      creditAmount: 0,
      remark: savedOrder.note,
      createdDateTime:savedOrder.createdDateTime
    };
    // const sale = {
    //   organizationId: savedOrder.organizationId,
    //   operationId: savedOrder._id,
    //   transactionId: savedOrder.salesOrder,
    //   date: savedOrder.createdDate,
    //   accountId: defAcc.salesAccount || undefined,
    //   action: "Sales Invoice",
    //   debitAmount: 0,
    //   creditAmount: savedOrder.saleAmount,
    //   remark: savedOrder.note,
    // };
    const cgst = {
      organizationId: savedOrder.organizationId,
      operationId: savedOrder._id,
      transactionId: savedOrder.salesOrder,
      date: savedOrder.createdDate,
      accountId: defAcc.outputCgst || undefined,
      action: "Sales Invoice",
      debitAmount: 0,
      creditAmount: savedOrder.cgst || 0,
      remark: savedOrder.note,
      createdDateTime:savedOrder.createdDateTime
    };
    const sgst = {
      organizationId: savedOrder.organizationId,
      operationId: savedOrder._id,
      transactionId: savedOrder.salesOrder,
      date: savedOrder.createdDate,
      accountId: defAcc.outputSgst || undefined,
      action: "Sales Invoice",
      debitAmount: 0,
      creditAmount: savedOrder.sgst || 0,
      remark: savedOrder.note,
      createdDateTime:savedOrder.createdDateTime
    };
    const igst = {
      organizationId: savedOrder.organizationId,
      operationId: savedOrder._id,
      transactionId: savedOrder.salesOrder,
      date: savedOrder.createdDate,
      accountId: defAcc.outputIgst || undefined,
      action: "Sales Invoice",
      debitAmount: 0,
      creditAmount: savedOrder.igst || 0,
      remark: savedOrder.note,
      createdDateTime:savedOrder.createdDateTime
    };
    const vat = {
      organizationId: savedOrder.organizationId,
      operationId: savedOrder._id,
      transactionId: savedOrder.salesOrder,
      date: savedOrder.createdDate,
      accountId: defAcc.outputVat || undefined,
      action: "Sales Invoice",
      debitAmount: 0,
      creditAmount: savedOrder.vat || 0,
      remark: savedOrder.note,
      createdDateTime:savedOrder.createdDateTime
    };
    const customer = {
      organizationId: savedOrder.organizationId,
      operationId: savedOrder._id,
      transactionId: savedOrder.salesOrder,
      date: savedOrder.createdDate,
      accountId: customerAccount._id || undefined,
      action: "Sales Invoice",
      debitAmount: savedOrder.totalAmount || 0,
      creditAmount: 0,
      remark: savedOrder.note,
      createdDateTime:savedOrder.createdDateTime
    };
    const customerPaid = {
      organizationId: savedOrder.organizationId,
      operationId: savedOrder._id,
      transactionId: savedOrder.salesOrder,
      date: savedOrder.createdDate,
      accountId: customerAccount._id || undefined,
      action: "Receipt",
      debitAmount: 0,
      creditAmount: savedOrder.paidAmount || 0,
      remark: savedOrder.note,
      createdDateTime:savedOrder.createdDateTime
    };
    const depositAccount = {
      organizationId: savedOrder.organizationId,
      operationId: savedOrder._id,
      transactionId: savedOrder.salesOrder,
      date: savedOrder.createdDate,
      accountId: defAcc.depositAccountId || undefined,
      action: "Receipt",
      debitAmount: savedOrder.paidAmount || 0,
      creditAmount: 0,
      remark: savedOrder.note,
      createdDateTime:savedOrder.createdDateTime
    };
    const otherExpense = {
      organizationId: savedOrder.organizationId,
      operationId: savedOrder._id,
      transactionId: savedOrder.salesOrder,
      date: savedOrder.createdDate,
      accountId: defAcc.otherExpenseAccountId || undefined,
      action: "Sales Invoice",
      debitAmount: 0,
      creditAmount: savedOrder.otherExpenseAmount || 0,
      remark: savedOrder.note,
      createdDateTime:savedOrder.createdDateTime
    };
    const freight = {
      organizationId: savedOrder.organizationId,
      operationId: savedOrder._id,
      transactionId: savedOrder.salesOrder,
      date: savedOrder.createdDate,
      accountId: defAcc.freightAccountId || undefined,
      action: "Sales Invoice",
      debitAmount: 0,
      creditAmount: savedOrder.freightAmount || 0,
      remark: savedOrder.note,
      createdDateTime:savedOrder.createdDateTime
    };
    const roundOff = {
      organizationId: savedOrder.organizationId,
      operationId: savedOrder._id,
      transactionId: savedOrder.salesOrder,
      date: savedOrder.createdDate,
      accountName: "Round Off",
      action: "Sales Invoice",
      debitAmount: savedOrder.roundOffAmount || 0,
      creditAmount: 0,
      remark: savedOrder.note,
      createdDateTime:savedOrder.createdDateTime
    };
  
    let salesTotalDebit = 0;
    let salesTotalCredit = 0;
  
    if (Array.isArray(savedOrder.salesJournal)) {
      savedOrder.salesJournal.forEach((entry) => {
  
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
      savedOrder.salesJournal.forEach((entry) => {
        const data = {
          organizationId: savedOrder.organizationId,
          operationId: savedOrder._id,
          transactionId: savedOrder.salesOrder,
          date: savedOrder.createdDateTime,
          accountId: entry.accountId || undefined,
          action: "Sales Invoice",
          debitAmount: 0,
          creditAmount: entry.creditAmount || 0,
          remark: savedOrder.note,
          createdDateTime:savedOrder.createdDateTime
        };
        createTrialEntry( data )
      });
  
      
   
  
  
  
    //Tax
    if(savedOrder.cgst){
      createTrialEntry( cgst )
    }
    if(savedOrder.sgst){
      createTrialEntry( sgst )
    }
    if(savedOrder.igst){
      createTrialEntry( igst )
    }
    if(savedOrder.vat){
      createTrialEntry( vat )
    }
  
    //Discount  
    if(savedOrder.totalDiscount){
      createTrialEntry( discount )
    }
  
    //Other Expense
    if(savedOrder.otherExpenseAmount){
      createTrialEntry( otherExpense )
    }
  
    //Freight
    if(savedOrder.freightAmount){
      createTrialEntry( freight )
    }
    
    //Round Off
    if(savedOrder.roundOffAmount){
      createTrialEntry( roundOff )
    }
   
    //Customer
    createTrialEntry( customer )
    
    //Paid
    if(savedOrder.paidAmount){
      createTrialEntry( customerPaid )
      createTrialEntry( depositAccount )
    }
  }
  
  
  
  async function createTrialEntry( data ) {
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
        createdDateTime:data.createdDateTime
  });
  await newTrialEntry.save();
  }

