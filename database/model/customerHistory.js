// v1.2

const mongoose = require("mongoose");
const { Schema } = mongoose;


const customerHistorySchema = new Schema({
  organizationId: {type:String},
  operationId: { type: String },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  // customerDisplayName
  title: { type: String },
  description: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // userName
  
  createdDateTime: { type: Date, default: () => new Date() },
});

const customerHistory = mongoose.model("Customer History", customerHistorySchema);

module.exports = customerHistory;










     