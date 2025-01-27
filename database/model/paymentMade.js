const mongoose = require('mongoose');
const { Schema } = mongoose;

const unpaidBillSchema = new Schema({
  billId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseBill' },
  billDate: { type: String },
  dueDate: { type: String },
  billNumber: { type: String },
  billAmount: { type: Number },
  amountDue: { type: Number },
  payment: { type: Number },
});

const paymentSchema = new Schema({
  organizationId: { type: String },

  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  //supplierDisplayName: { type: String },
  
  // payment:{type:String}, // input field for payment
  paymentMade  :  { type: String },  //prefix
  paymentDate: { type: String },
  
  // paymentId: { type: String }, //prefix
  paymentMode: { type: String },// cash, bank
  
  paidThroughAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Accounts' },//accounts
  
  reference: { type: String },
  notes: { type: String },
  attachments: { type: String },
  createdDate: { type: String },
  // updatedDate: { type: String },
  total:{ type: Number },
  amountPaid: { type: Number },
  amountUsedForPayments: { type: Number},
  // amountRefunded: { type: Number},
  amountInExcess: { type : Number},
  unpaidBills: [unpaidBillSchema],
  
  
  createdDateTime: { type: Date, default: () => new Date() },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  //userName
});

const PurchasePayment = mongoose.model('Payment Made', paymentSchema);
module.exports = PurchasePayment;
