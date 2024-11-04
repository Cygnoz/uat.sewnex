const mongoose = require('mongoose');
const { Schema } = mongoose;

const unpaidBillSchema = new Schema({
  billDate: { type: String },
  dueDate: { type: String },
  billId: { type: String },
  billNumber: { type: Number },
  billAmount: { type: Number },
  amountDue: { type: Number },
  payment: { type: Number }
});

const paymentSchema = new Schema({
  organizationId: { type: String },
  supplierId: { type: String },
  supplierDisplayName: { type: String },
  payment:{type:String},
  paymentMade :  { type: Number },
  paymentDate: { type: String },
  paymentId: { type: String },
  paymentMode: { type: String },
  paidThrough: { type: String },
  reference: { type: String },
  notes: { type: String },
  attachments: { type: String },
  createdDate: { type: String },
  updatedDate: { type: String },
  total:{ type: Number },
  amountPaid: { type: Number },
  amountUsedForPayments: { type: Number},
  amountRefunded: { type: Number},
  amountInExcess: { type : Number},
  unpaidBills: [unpaidBillSchema]
});

const PurchasePayment = mongoose.model('Payment Made', paymentSchema);
module.exports = PurchasePayment;
