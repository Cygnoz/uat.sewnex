// v1.1

const mongoose = require("mongoose");
const { Schema } = mongoose;


const customerHistorySchema = new Schema({
  organizationId: {type:String},
  operationId: { type: String },
  customerId: { type: String },
  customerDisplayName: { type: String },
  title: { type: String },
  description: { type: String },
  userId: { type: String },
  userName: { type: String },
  
  createdDateTime: { type: Date, default: () => new Date() },
});

const customerHistory = mongoose.model("Customer History", customerHistorySchema);

module.exports = customerHistory;










     