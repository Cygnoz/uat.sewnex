//v1.0

const mongoose = require('mongoose')
const { Schema } = mongoose

const serviceSchema = new Schema({

  orderServiceId: {type: mongoose.Schema.Types.ObjectId, ref: 'SewnexOrderService'},
  }, { _id: false });


const journalSchema = new Schema({
  accountId: {type: mongoose.Schema.Types.ObjectId, ref: 'Accounts'},
  debitAmount: {type:Number},
  creditAmount: {type:Number},
  }, { _id: false });


const SewnexOrderSchema = new Schema ({

  organizationId: { type: String, index: true },
  
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  //customerName
  placeOfSupply: { type: String },

  salesOrder: { type: String }, //prefix
  saleOrderDate: { type: String },
  
  service: [serviceSchema],  

  saleAmount: { type: Number },
  subTotal: { type: Number },
  totalService: { type: Number },
  discountTransactionType: { type: String }, // Currency,Percentage
  discountTransactionAmount: { type: Number },

  cgst: { type: Number },
  sgst: { type: Number },
  igst: { type: Number },
  vat: { type: Number },
  
  taxType: { type: String },//Intra, Inter, Non-tax, VAT 
  
  totalDiscount: { type: Number },
  totalTax: { type: Number },
  totalAmount: { type: Number },
  
  paidAmount: { type: Number }, 
  balanceAmount: { type: Number },
  depositAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Accounts' },
  paymentMethod: { type: String },


  paidStatus: { type: String },

  salesJournal:[ journalSchema ], 

  editLimit: {type: Boolean, default: true},   // true - before taxation file date  |  false - after taxation file date

  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  //userName

})


const SewnexOrder = mongoose.model("SewnexOrder", SewnexOrderSchema);

module.exports = SewnexOrder;



