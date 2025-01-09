const mongoose = require('mongoose')
const { Schema } = mongoose;

const itemsSchema = new Schema({
  itemId: { type: String },
  itemName: { type: String },

  itemQuantity: { type: Number },
  itemCostPrice: { type: Number },

  itemTax: { type: Number },

  itemDiscountType: { type: String }, //percentage/rupees
  itemDiscount: { type: String },
  
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
},{ _id: false });

const purchaseOrderSchema = new mongoose.Schema({
  organizationId: {type:String},
  supplierId: { type: String},
  supplierDisplayName: { type: String },
  
  //supplierBillingAddress:
  supplierBillingCountry: { type: String },
  supplierBillingState: { type: String },
  expectedShipmentDate: { type: String },


  taxMode: { type: String }, // intra/inter/None

  sourceOfSupply: { type: String },
  destinationOfSupply: { type: String },

  deliveryAddress: { type: String},  // customer/organization
  // customerId: { type: String},

  purchaseOrder: { type: String },  //prefix
  reference: { type: String },
  shipmentPreference: { type: String },   // e.g., 'Road', 'Rail', 'Air', 'Sea'
  purchaseOrderDate: { type: String },
  paymentTerms: { type: String },
  
  // discountType: { type: String}, // item line / transaction line / both
  // taxType: { type: String },  //GST/VAT

  // Item table
  items: [itemsSchema],

  // Other details:
  otherExpenseAmount: { type: Number },
  otherExpenseReason: { type: String },
  freightAmount: { type: Number },
  vehicleNo: { type: String }, 
  addNotes: { type: String },
  termsAndConditions: { type: String },
  attachFiles: { type: String }, 

  //transaction details
  subTotal: { type: Number },
  totalItem: { type: Number },

  sgst: { type: Number },
  cgst: { type: Number },
  igst: { type: Number },
  vat: { type: Number },

  totalTaxAmount: { type: Number },   // sgst + cgst
  itemTotalDiscount: { type: Number },

  transactionDiscountType: { type: String }, //percentage/rupee
  transactionDiscount: { type: Number },
  transactionDiscountAmount: { type: Number },  // if percentage
  roundOffAmount: { type: Number },
  grandTotal: { type: Number },
  status: { type: String }, // Open/Converted to bills
  // createdDate: { type: String },
  // lastModifiedDate: { type: String }

  //Create info
//Create info
createdDateTime: { type: Date, default: () => new Date() },

//lastModifiedDate
lastModifiedDate:{type:String},
});

const PurchaseOrder = mongoose.model('purchaseOrder',purchaseOrderSchema)
module.exports = PurchaseOrder