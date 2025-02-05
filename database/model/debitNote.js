const mongoose = require('mongoose');
const { Schema } = mongoose;

const itemsSchema = new Schema({
  itemId: {type: mongoose.Schema.Types.ObjectId, ref: 'Item'},
  // itemName: { type: String },

  itemQuantity: { type: Number },
  stock: { type: Number },
  itemCostPrice: { type: Number },

  itemTax: { type: Number },

  // itemDiscountType: { type: String }, //percentage/currency
  // itemDiscount: { type: Number },

  itemAmount: { type: Number },

  taxPreference: {type:String}, //Taxable or Not
  itemSgst: { type: Number },
  itemCgst: { type: Number },
  itemIgst: { type: Number },
  itemVat: { type: Number },

  itemSgstAmount: { type: Number },
  itemCgstAmount: { type: Number },
  itemIgstAmount: { type: Number },
  itemVatAmount: { type: Number },

  // purchaseAccountId: {type:String}
},{ _id: false });

const journalSchema = new Schema({
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Accounts' },
  debitAmount: { type: Number },
  creditAmount: { type: Number },
});

const debitNoteSchema = new mongoose.Schema({
  organizationId: {type:String},
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  // supplierDisplayName: { type: String },

  sourceOfSupply: { type: String },
  destinationOfSupply: { type: String },

  taxMode: { type: String }, // intra/inter/Vat

  billId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseBill' },
  billNumber: { type: String },
  billDate: { type: String },
  billType: { type: String },
  debitNote: { type: String },  //prefix
  orderNumber: { type: String },
  supplierDebitDate: { type: String },
  paymentMode: { type: String },  // cash/credit
  depositAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Accounts' },
  // depositToAccountName
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
  // itemTotalDiscount: { type: Number },

  // transactionDiscountType: { type: String }, //percentage/currency
  // transactionDiscount: { type: Number },
  // transactionDiscountAmount: { type: Number },  // if percentage
  grandTotal: { type: Number },
  createdDate: { type: String },
  // status: { type: String }, // Open/Closed

  purchaseJournal:[ journalSchema ], 

  createdDateTime: { type: Date, default: () => new Date() },

  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  //userName

});

const DebitNote = mongoose.model('DebitNote', debitNoteSchema);
module.exports = DebitNote;

