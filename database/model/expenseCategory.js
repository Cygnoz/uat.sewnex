const mongoose = require("mongoose");
const { Schema } = mongoose;
 
const ExpenseCategorySchema = new Schema({
    organizationId: { type: String },
    expenseCategory: { type: String },
    description: { type: String },
});
 
const expenseCategory = mongoose.model("expenseCategory", ExpenseCategorySchema);
 
module.exports = expenseCategory;