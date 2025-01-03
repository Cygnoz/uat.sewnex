const mongoose = require('mongoose')
const { Schema } = mongoose

const invoiceSchema = new Schema({

    invoiceId: {type:String},
    salesInvoice: {type:String},//prefix
    salesInvoiceDate: { type: String },  
    dueDate: { type: String },
    totalAmount: { type: Number },
    balanceAmount: { type: Number },
    paymentAmount: { type: Number },    

  }, { _id: false });

const SalesReceiptSchema = new Schema ({

  organizationId: { type: String, index: true },
  
  customerId: { type: String },
  customerName: { type: String },

  bankCharge: { type: String },  
  paymentDate: { type: String },

  payment: { type: String }, //prefix
  paymentMode: { type: String },   

  depositAccountId: { type: String },  
  reference: { type: String }, 
  
  invoice: [invoiceSchema],  
  
  note: { type: String },

  status: { type: String },

  amountReceived: { type: Number },

  createdDateTime: { type: Date, default: () => new Date() },
  userId: { type: String },
  userName: { type: String },
})


const SalesReceipt = mongoose.model("SalesReceipt", SalesReceiptSchema);

module.exports = SalesReceipt;



