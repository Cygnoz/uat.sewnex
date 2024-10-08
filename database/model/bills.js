const mongoose = require('mongoose');
const { Schema } = mongoose;

const itemTableSchema = new Schema({
  itemId: { type: String },
  itemProduct: { type: String },
  itemQuantity: { type: String },
  itemSellingPrice: { type: String },
  itemDiscount: { type: String },
  itemAmount: { type: String },

  itemSgst: { type: String },
  itemCgst: { type: String },
  itemIgst: { type: String },
  itemVat: { type: String },
}, { _id: false });

const PurchaseBillSchema = new Schema({
  organizationId: { type: String },
  supplierId: { type: String },
  supplierDisplayName: { type: String },
  billNumber: { type: String },//prefix
  billDate: { type: String }, // Changed to String, use date format when parsing
  dueDate: { type: String },  // Changed to String, use date format when parsing
  orderNumber: { type: String },//prefix

  //supplierBillingAddress
  supplierBillingCountry: { type: String },
  supplierBillingState: { type: String },


  taxMode: { type: String },  // 'intra' or 'inter'

  sourceOfSupply: { type: String },
  destinationOfSupply: { type: String },

  sgst: { type: String },
  cgst: { type: String },
  igst: { type: String },
  vat: { type: String },

  paymentTerms: { type: String },
  paymentMode: { type: String },

  itemTable: [itemTableSchema],

  otherExpense: { type: String },
  otherExpenseReason: { type: String },
  freight: { type: String },
  vehicleNo: { type: String },
  //transportationMode: { type: String },
  addNotes: { type: String },
  termsAndConditions: { type: String },
  attachFiles: {type:String},  // Array of file paths or URLs as Strings

  subTotal: { type: String },
  totalItem: { type: String },
  transactionDiscount: { type: String },
  totalTaxAmount: { type: String },
  roundOff: { type: String },
  grandTotal: { type: String },

  paidStatus: { type: String }
});

const PurchaseBill = mongoose.model('PurchaseBill', PurchaseBillSchema);

module.exports = PurchaseBill;
