const mongoose = require("mongoose");
const { Schema } = mongoose;

const salesOverTimeSchema = new Schema({
    month: { type: String }, // e.g., "January", "February"
    sales: { type: Number } 
});

const topSalesOrderSchema = new Schema({
    customerId: { type: String },
    customer: { type: String },
    salesPerson: { type: String },
    revenue: { type: Number }
});

const topSalesByCustomerSchema = new Schema({
    customerId: { type: String },
    customer: { type: String },
    sales: { type: Number }
});

const recentTransactionSchema = new Schema({
    invoiceNo: { type: String },
    month: { type: String }, // Month of the transaction
    customerId: { type: String },
    customer: { type: String },
    status: { type: String }, //enum: ["Paid", "Draft"]
    amount: { type: Number }
});

// Main Sales Dashboard Schema
const salesDashboardSchema = new Schema({
    organizationId: { type: String, required: true },
    year: { type: Number, required: true }, // Year for the document (e.g., 2024)

    totalSalesRevenue: { type: Number, required: true },
    totalSalesOrder: { type: Number, required: true },
    totalSalesInvoice: { type: Number, required: true },
    totalSalesQuote: { type: Number, required: true },

    salesOverTime: [salesOverTimeSchema], // Array of month-wise sales
    topSalesOrder: [topSalesOrderSchema],
    topSalesByCustomer: [topSalesByCustomerSchema], 
    recentTransaction: [recentTransactionSchema] // Array of recent transactions (month-wise)
});

// Export the model
const SalesDashboard = mongoose.model("SalesDashboard", salesDashboardSchema);
module.exports = SalesDashboard;
