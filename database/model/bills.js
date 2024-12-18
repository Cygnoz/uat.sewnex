const mongoose = require('mongoose');
const { Schema } = mongoose;

const itemsSchema = new Schema({
  itemId: { type: String },
  itemName: { type: String },

  itemQuantity: { type: Number },
  itemCostPrice: { type: Number },

  itemTax:{ type:Number },

  itemDiscount: { type: Number },
  itemDiscountType: { type: String }, //percentage/currency

  itemAmount: { type: Number },

  taxPreference: {type:String}, //Taxable or Not
  itemSgst: { type: Number },
  itemCgst: { type: Number },
  itemIgst: { type: Number },
  itemVat: { type: Number },

  itemSgstAmount: { type: Number },
  itemCgstAmount : { type:Number },
  itemIgstAMount : { type:Number },
  itemVatAmount: { type: Number },

}, { _id: false });

const PurchaseBillSchema = new Schema({
  organizationId: { type: String },
  supplierId: { type: String },
  supplierDisplayName: { type: String },

  //supplierBillingAddress
  supplierBillingCountry: { type: String },
  supplierBillingState: { type: String },

  //deliveryAddress: { type: String},  // customer/organization
  // customerId: { type: String},

  billNumber: { type: String }, //type

  sourceOfSupply: { type: String },
  destinationOfSupply: { type: String },

  taxMode: { type: String },  // 'intra' or 'inter'

  orderNumber: { type: String },  //purchaseOrder(prefix)
  reference: { type: String },
  puchaseOrderDate: { type: String },
  expectedShipmentDate: { type: String },
  shipmentPreference: { type: String },   // e.g., 'Road', 'Rail', 'Air', 'Sea'
  paymentTerms: { type: String },
  paymentMode: { type: String },
  paidThrough: { type: String },

  billDate: { type: String }, 
  dueDate: { type: String },  
  
  
  items: [itemsSchema],

  otherExpenseAccountId: { type: String },
  otherExpenseAmount: { type: Number },
  otherExpenseReason: { type: String },
  freightAccountId: { type: String },
  freightAmount: { type: Number },
  vehicleNo: { type: String },
  addNotes: { type: String },
  termsAndConditions: { type: String },
  attachFiles: {type:String},  // Array of file paths or URLs as Strings

  subTotal: { type: Number },
  totalItem: { type: Number },

  sgst: { type: Number },
  cgst: { type: Number },
  igst: { type: Number },
  vat: { type: Number },

  transactionDiscount: { type: Number },
  transactionDiscountType: { type: String }, //percentage/rupee
  transactionDiscountAmount: { type: Number }, 
  totalTaxAmount: { type: Number },
  itemTotalDiscount: { type: Number },
  roundOffAmount: { type: Number },
  totalDiscount: { type: Number },
  grandTotal: { type: Number },

  paidAmount:{ type : Number },
  balanceAmount: { type:Number },
  purchaseAmount: { type:Number },

  paidStatus: { type: String },
  
  createdDate: { type: String },

  purchaseOrderId:{ type: String }

});

const PurchaseBill = mongoose.model('PurchaseBill', PurchaseBillSchema);

module.exports = PurchaseBill;
