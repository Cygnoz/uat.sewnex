const mongoose = require("mongoose");
const { Schema } = mongoose;
 
const expenseSchema = new Schema({
    organizationId: { type: String },
    expenseDate: { type: String },
    expenseCategory: { type: String },
    expenseName: { type: String },
    amount: { type: String },
    paymentMethod: { type: String },
    expenseAccount: { type: String },
    expenseType: { type: String },
    hsnCode: { type: String },
    sacCode: { type: String },
    vendor: { type: String },
    gstTreatment: { type: String },
    vendorGSTIN: { type: String },
    source: { type: String },
    destination: { type: String },
    reverseCharge: { type: String },
    currency: { type: String },
    tax: { type: String },
    invoiceNo: { type: String },
    notes: { type: String },
    uploadFiles: { type: String },


    // Record mileage:-
    defaultMileageCategory: { type: String },
    defaultUnit: { type: String },
    startDate: { type: String },
    mileageRate: { type: String },

    date: { type: String },
    employee: { type: String },
    calculateMileageUsing: { type: String },
    distance: { type: String },
});
 
const Expense = mongoose.model("Expense", expenseSchema);
 
module.exports = Expense;