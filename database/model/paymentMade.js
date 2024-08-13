const mongoose = require('mongoose');

const { Schema } =  mongoose 

const unpaidBillSchema = new Schema({
    date:{type:String},
    dueDate:{type:String},
    billId:{type:String},
    billAmount:{type:String},
    amountDue:{type:String},
    payment:{type:String}
})

const purchaseSchema = new Schema({
  organizationId: {
    type: String
  },
  supplier: {
    type: String
  },
  paymentDate: {
    type: String
  },
  paymentId: {
    type: String,
  },
  paymentMode: {
    type: String
  },
  paidThrough: {
    type: String
  },
  reference: {
    type: String
  },
  notes: {
    type: String
  },
  attachments: {
    type: String // Array of strings to store attachment URLs or paths
  },
  createdDate:{
    type:String
  },
  updatedDate:{
    type:String
  },
  unpaidBill : [unpaidBillSchema]
});

const PurchasePayment = mongoose.model('PurchaseOrder', purchaseSchema);
module.exports = PurchasePayment;