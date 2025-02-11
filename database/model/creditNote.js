const mongoose = require('mongoose');
const { Schema } = mongoose;

const itemsSchema = new Schema({
  itemId: {type: mongoose.Schema.Types.ObjectId, ref: 'Item'},
  //itemName

  quantity: {type:Number},
  stock: {type:Number},
  sellingPrice: {type:Number},

  taxPreference: {type:String}, //Taxable or Not
  taxGroup: {type:String}, //GST12...

  cgst: { type: Number },
  sgst: { type: Number },
  igst: { type: Number },
  vat: { type: Number },

  cgstAmount: { type: Number },
  sgstAmount: { type: Number },
  igstAmount: { type: Number },
  vatAmount: { type: Number },

  itemTotalTax: {type:Number},
  itemAmount: { type: Number },
  salesAccountId: {type:String}

},{ _id: false });


const journalSchema = new Schema({
  accountId: {type: mongoose.Schema.Types.ObjectId, ref: 'Accounts'},
  debitAmount: {type:Number},
  creditAmount: {type:Number},
}, { _id: false });



const creditNoteSchema = new mongoose.Schema({
  organizationId: {type:String},
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  //customerName

  placeOfSupply: { type: String },

  taxType: { type: String },//Intra, Inter, Non-tax, VAT 

  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesInvoice' },
  //salesInvoice -invoice prefix
  //salesInvoiceDate
  
  // invoiceNumber: { type: String }, //invoice prefix
  // invoiceDate: { type: String },
  
  invoiceType: { type: String },
  creditNote: { type: String },  //prefix
  // orderNumber: { type: String },
  customerCreditDate: { type: String },
  
  paymentMode: { type: String },  // cash/credit
  paidThroughAccountId: {type: mongoose.Schema.Types.ObjectId, ref: 'Accounts'},
  //paidThroughAccountName
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

  totalTax: { type: Number },   // sgst + cgst
  totalAmount: { type: Number },

  salesJournal:[ journalSchema ], 

  createdDateTime: { type: Date, default: () => new Date() },

  //lastModifiedDate
  // lastModifiedDate:{type: Date},

  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  //userName

  // status: { type: String }, // Open/Closed

});

const CreditNote = mongoose.model('CreditNote', creditNoteSchema);
module.exports = CreditNote;