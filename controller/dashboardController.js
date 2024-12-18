const SalesDashboard = require('../database/model/dashboard');
const SalesOrder = require('../database/model/salesOrder');
const SalesQuote = require('../database/model/salesQuotes');
const SalesReceipt = require('../database/model/salesReceipt');
const CreditNote = require('../database/model/creditNote');
const Organization = require('../database/model/organization');
const Invoice = require('../database/model/salesInvoice');
const Customer = require('../database/model/customer');
const Prefix = require("../database/model/prefix");
const mongoose = require('mongoose');
const moment = require("moment-timezone");


// Fetch existing data
const dataExist = async ( organizationId, customerId, orderId, quoteId, receiptId, invoiceId, CNoteId ) => {
    const [ organizationExists, customerExist, salesOrderExist, salesQuoteExist, salesReceiptExist, invoiceExist, creditNoteExist ] = await Promise.all([
      Organization.findOne({ organizationId }, { organizationId: 1, organizationCountry: 1, state: 1 }),
      Customer.findOne({ organizationId , _id:customerId}, { _id: 1 }),
      SalesOrder.findOne({ organizationId, _id:orderId }, { _id: 1 }),
      SalesQuote.findOne({ organizationId, _id:quoteId }, { _id: 1 }),
      SalesReceipt.findOne({ organizationId, _id:receiptId }, { _id: 1 }),
      Invoice.findOne({ organizationId, _id:invoiceId }, { _id: 1 }),
      CreditNote.findOne({ organizationId, _id:CNoteId }, { _id: 1 }),
      Prefix.findOne({ organizationId })
    ]);    
  return { organizationExists, customerExist, salesOrderExist, salesQuoteExist, salesReceiptExist, invoiceExist, creditNoteExist };
};


// Function to add a new sales dashboard document
exports.createSalesDashboard = async (req, res) => {
    console.log("Add Expense:", req.body);

    try {
        const { organizationId, id: userId, userName } = req.user;

        //Clean Data
        const cleanedData = req.body;

        const { topSalesOrder, topSalesByCustomer, recentTransaction } = cleanedData;

        const customerIds = [
            ...topSalesOrder.map(i => i.customerId),
            ...topSalesByCustomer.map(i => i.customerId),
            ...recentTransaction.map(i => i.customerId)
        ];
        
        if (!customerIds.every(id => mongoose.Types.ObjectId.isValid(id))) {
          return res.status(400).json({ message: `Invalid customer ID(s) detected: ${customerIds}` });
        }

        // Validate organizationId
        const { organizationExists, customerExist, salesOrderExist, salesQuoteExist, salesReceiptExist, invoiceExist, creditNoteExist } = await dataExist(organizationId, customerId, orderId, quoteId, receiptId, invoiceId, CNoteId);

        currentDate(cleanedData);

        // Create new sales dashboard document
        const newDashboard = new SalesDashboard({
            organizationId,
            year: currentYear, // Automatically set to current year
            totalSalesRevenue,
            totalSalesOrder,
            totalSalesInvoice,
            totalSalesQuote,
            salesOverTime: updatedSalesOverTime,
            topSalesOrder,
            topSalesByCustomer,
            recentTransaction: updatedRecentTransaction
        });

        // Save to the database
        await newDashboard.save();

        res.status(201).json({
            message: "Sales Dashboard document created successfully!",
            data: newDashboard
        });
    } catch (error) {
        console.error("Error creating sales dashboard:", error.message);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};




function currentDate(cleanedData) {
    const currentDate = new Date();
    const currentMonth = currentDate.toLocaleString("default", { month: "long" }); // e.g., "March"
    const currentYear = currentDate.getFullYear(); // e.g., 2024

    // Add current month to salesOverTime and recentTransaction
    const updatedSalesOverTime = cleanedData.salesOverTime?.map(entry => ({
        month: entry.month || currentMonth, // Default to current month
        sales: entry.sales
    })) || [];

    const updatedRecentTransaction = cleanedData.recentTransaction?.map(entry => ({
        invoiceNo: entry.invoiceNo,
        month: entry.month || currentMonth, // Default to current month
        customer: entry.customer,
        status: entry.status,
        amount: entry.amount
    })) || [];
}