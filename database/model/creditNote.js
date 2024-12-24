const mongoose = require('mongoose');
const { Schema } = mongoose;

const itemsSchema = new Schema({
  itemId: { type: String },
  itemName: { type: String },

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

  itemTotaltax: {type:Number},

  itemAmount: { type: Number },

},{ _id: false });

const creditNoteSchema = new mongoose.Schema({
  organizationId: {type:String},
  customerId: { type: String},
  customerDisplayName: { type: String },

  placeOfSupply: { type: String },

  taxtype: { type: String },//Intra, Inter, Non-tax, VAT 

  invoiceId: { type: String },
  invoiceNumber: { type: String },
  invoiceDate: { type: String },
  invoiceType: { type: String },
  creditNote: { type: String },  //prefix
  orderNumber: { type: String },
  customerCreditDate: { type: String },
  paymentMode: { type: String },  // cash/credit
  depositTo: { type: String },
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

  createdDate: { type: String },

  userId: { type: String },
  userName: { type: String },

  // status: { type: String }, // Open/Closed

});

const CreditNote = mongoose.model('CreditNote', creditNoteSchema);
module.exports = CreditNote;

