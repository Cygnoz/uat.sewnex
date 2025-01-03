// v1.1

const mongoose = require("mongoose");
const { Schema } = mongoose;


const seriesSchema = new Schema({
  seriesName: { type: String },
  status: { type: Boolean }, 
  
  journal: { type: String }, //Journal
  journalNum: { type: Number },

  creditNote: { type: String },//Credit note
  creditNoteNum: { type: Number },

  receipt: { type: String },//receipt  *
  receiptNum: { type: Number },
  
  purchaseOrder: { type: String },//purchase order
  purchaseOrderNum: { type: Number },

  salesOrder: { type: String },//sales order
  salesOrderNum: { type: Number },

  payment: { type: String },//payment *
  paymentNum: { type: Number },

  bill: { type: String },//bill
  billNum: { type: Number },

  debitNote: { type: String },//debit note
  debitNoteNum: { type: Number },

  invoice: { type: String },//invoice
  invoiceNum: { type: Number },

  quote: { type: String },//quote
  quoteNum: { type: Number },

  deliveryChallan: { type: String },//delivery challan
  deliveryChallanNum: { type: Number },

  expense: { type: String },//expense
  expenseNum: { type: Number }, 

});

const prefixSchema = new Schema({
  
  organizationId: { type: String },  
  series: [seriesSchema],   

});

const Prefix = mongoose.model("Prefix", prefixSchema);
module.exports = Prefix;
