const mongoose = require('mongoose');
const { Schema } = mongoose;

const itemsSchema = new Schema({
  itemId: { type: String },
  itemName: { type: String },

  itemQuantity: { type: Number },
  itemSellingPrice: { type: Number },
  itemCostPrice: { type: Number },

  itemTax: { type: Number },

  itemDiscountType: { type: String }, //percentage/currency
  itemDiscount: { type: Number },

  itemAmount: { type: Number },

  itemSgst: { type: Number },
  itemCgst: { type: Number },
  itemIgst: { type: Number },
  itemVat: { type: Number },

  itemSgstAmount: { type: Number },
  itemCgstAmount: { type: Number },
  itemIgstAmount: { type: Number },
  itemVatAmount: { type: Number },
},{ _id: false });

const debitNoteSchema = new mongoose.Schema({
  organizationId: {type:String},
  supplierId: { type: String},
  supplierDisplayName: { type: String },

  sourceOfSupply: { type: String },
  destinationOfSupply: { type: String },

  taxMode: { type: String }, // intra/inter/Vat

  billId: { type: String },
  billNumber: { type: String },
  billDate: { type: String },
  billType: { type: String },
  debitNote: { type: String },  //prefix
  orderNumber: { type: String },
  supplierDebitDate: { type: String },
  subject: { type: String }, 

  // Item table
  items: [itemsSchema], 

  // Other details:
  addNotes: { type: String },
  attachFiles: { type: String }, 
  termsAndConditions: { type: String }, 

  //transaction details
  subTotal: { type: Number },
  totalItem: { type: Number },

  sgst: { type: Number },
  cgst: { type: Number },
  igst: { type: Number },
  vat: { type: Number },

  totalTaxAmount: { type: Number },   // sgst + cgst
  itemTotalDiscount: { type: Number },

  transactionDiscountType: { type: String }, //percentage/currency
  transactionDiscount: { type: Number },
  transactionDiscountAmount: { type: Number },  // if percentage
  grandTotal: { type: Number },
  status: { type: String }, // Open/Closed
  createdDate: { type: String },

});

const DebitNote = mongoose.model('DebitNote', debitNoteSchema);
module.exports = DebitNote;

