const mongoose = require('mongoose')
const { Schema } = mongoose;

const itemTableSchema = new Schema({
  itemId: { type: String },
  itemProduct: { type: String },
  itemQuantity: { type: String },
  itemSellingPrice: { type: String },
  itemTax: { type: String },
  itemDiscount: { type: String },
  itemAmount: { type: String },
  
  totalItems: { type: Number },

  itemSgst: { type: String },
  itemCgst: { type: String },
  itemIgst: { type: String },
  itemVat: { type: String },
},{ _id: false });

const purchaseOrderSchema = new mongoose.Schema({
  organizationId: {type:String},
  taxMode: { type: String }, // intra/inter
  supplierId: { type: String},
  supplierDisplayName: { type: String },
  
  //supplierBillingAddress:
  supplierBillingAttention: { type: String },
  supplierBillingCountry: { type: String },
  supplierBillingAddressStreet1: { type: String },
  supplierBillingAddressStreet2: { type: String },
  supplierBillingCity: { type: String },
  supplierBillingState: { type: String },
  supplierBillingPinCode: { type: String },
  supplierBillingPhone: { type: String },
  supplierBillingFaxNum: { type: String },

  supplierGstNo: { type: String },
  supplierMobile: { type: String },

  sourceOfSupply: { type: String },
  destinationOfSupply: { type: String },

  deliveryAddress: { type: Boolean}, 
  customer: { type: String},
  organization: { type: String},

  sgst: { type: Number },
  cgst: { type: Number },
  igst: { type: Number },
  vat: { type: Number },
  taxType: { type: String },

  reference: { type: String },
  purchaseOrder: { type: String },
  shipmentPreference: { type: String }, 
  purchaseOrderDate: { type: Date },
  expectedShipmentDate: { type: Date },
  paymentTerms: { type: String },
  paymentMode: { type: String },
  subTotal: { type: Number },
  cashDiscount: { type: Number },
  discountType: { type: String}, // item line / transaction line
  grandTotal: { type: Number },

  // Item table
  itemTable: [itemTableSchema],

  // Other details:
  expense: { type: Number },
  freight: { type: Number },
  remark: { type: String },
  roundoff: { type: Number },
  vehicleNoORcontainerNo: { type: String }, // vehicleNo / containerNo
  destination: { type: String },
  transportMode: { type: String }, // e.g., 'Road', 'Rail', 'Air', 'Sea'
  addNotes: { type: String },
  termsAndConditions: { type: String },

  attachFiles: { type: String } // file paths or references
});

const PurchaseOrder = mongoose.model('purchaseOrder',purchaseOrderSchema)
module.exports = PurchaseOrder