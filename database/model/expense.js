const mongoose = require("mongoose");
const { Schema } = mongoose;
 

const expenseCategorySchema = new Schema({
    expenseAccountId: {type:String},
    expenseAccount: {type:String},
    note: {type:String},
    amount: {type:String}
});

const expenseSchema = new Schema({
    organizationId:{type :String},
    expenseDate: {type:String},
    employee: {type:String},
    paidThrough: {type:String},
    paidThroughId: {type:String},
    distance: {type:Number},
    ratePerKm: {type:Number},
    Ventor: {type:String},
    invoice: {type:String},
    expense : [expenseCategorySchema]


});
 
const Expense = mongoose.model("Expense", expenseSchema);
 
module.exports = Expense;