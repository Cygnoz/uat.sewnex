const mongoose = require('mongoose')
const { Schema } = mongoose;

const itemTableSchema = new Schema({
  itemId: { type: String },
  itemProduct: { type: String },
  itemQuantity: { type: String },
  itemSellingPrice: { type: String },
  itemDiscount: { type: String },
  itemDiscountType: { type: String }, //percentage/rupees
  itemAmount: { type: String },

  itemSgst: { type: String },
  itemCgst: { type: String },
  itemIgst: { type: String },
  itemVat: { type: String },
},{ _id: false });

const purchaseOrderSchema = new mongoose.Schema({
  organizationId: {type:String},
  supplierId: { type: String},
  supplierDisplayName: { type: String },
  
  //supplierBillingAddress:
  // supplierBillingAttention: { type: String },
  supplierBillingCountry: { type: String },
  // supplierBillingAddressStreet1: { type: String },
  // supplierBillingAddressStreet2: { type: String },
  // supplierBillingCity: { type: String },
  supplierBillingState: { type: String },
  // supplierBillingPinCode: { type: String },
  // supplierBillingPhone: { type: String },
  // supplierBillingFaxNum: { type: String },

  // supplierGstNo: { type: String },
  // supplierMobile: { type: String },

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
  taxType: { type: String },  //GST/VAT

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
  totalDiscount: { type: String }, 
  totalTaxAmount: { type: Number },
  roundOff: { type: Number },
  grandTotal: { type: Number },
  status: { type: String }, // Open/Converted to bills

});

const PurchaseOrder = mongoose.model('purchaseOrder',purchaseOrderSchema)
module.exports = PurchaseOrder