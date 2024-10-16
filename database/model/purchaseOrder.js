const mongoose = require('mongoose')
const { Schema } = mongoose;

const itemTableSchema = new Schema({
  itemId: { type: String },
  itemName: { type: String },
  itemQuantity: { type: String },
  itemSellingPrice: { type: String },
  itemTax: { type: String },
  itemDiscountType: { type: String }, //percentage/rupees
  itemDiscount: { type: String },
  itemAmount: { type: Number },

  itemSgst: { type: String },
  itemCgst: { type: String },
  itemIgst: { type: String },
  itemVat: { type: String },
},{ _id: false });

const purchaseOrderSchema = new mongoose.Schema({
  organizationId: {type:String},
  supplierId: { type: String},
  // supplierDisplayName: { type: String },
  
  //supplierBillingAddress:
  supplierBillingCountry: { type: String },
  supplierBillingState: { type: String },

  taxMode: { type: String }, // intra/inter/None

  sourceOfSupply: { type: String },
  destinationOfSupply: { type: String },

  deliveryAddress: { type: String},  // customer/organization
  customerId: { type: String},

  purchaseOrder: { type: String },  //prefix
  reference: { type: String },
  shipmentPreference: { type: String },   // e.g., 'Road', 'Rail', 'Air', 'Sea'
  purchaseOrderDate: { type: String },
  expectedShipmentDate: { type: String },
  paymentTerms: { type: String },
  paymentMode: { type: String },  //
  
  discountType: { type: String}, // item line / transaction line / both
  // taxType: { type: String },  //GST/VAT

  // Item table
  itemTable: [itemTableSchema],

  // Other details:
  otherExpense: { type: Number },
  otherExpenseReason: { type: String },
  freight: { type: Number },
  vehicleNo: { type: String }, 
  addNotes: { type: String },
  termsAndConditions: { type: String },
  attachFiles: { type: String }, 

  //transaction details
  subTotal: { type: Number },
  totalItem: { type: Number },

  sgst: { type: String },
  cgst: { type: String },
  igst: { type: Number },
  vat: { type: Number },

  transactionDiscountType: { type: String }, //percentage/rupee
  transactionDiscount: { type: String },
  transactionDiscountAmount: { type: String },
  beforeTaxDiscountAmount: { type: String },
  totalDiscount: { type: String },
  totalTaxAmount: { type: Number },
  afterTaxDiscountAmount: { type: String },
  roundOff: { type: Number },
  grandTotal: { type: Number },
  status: { type: String }, // Open/Converted to bills

});

const PurchaseOrder = mongoose.model('purchaseOrder',purchaseOrderSchema)
module.exports = PurchaseOrder