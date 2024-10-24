const mongoose = require('mongoose')
const { Schema } = mongoose

const itemsSchema = new Schema({

    itemId: {type:String},
    itemName: {type:String},

    quantity: {type:Number},
    sellingPrice: {type:Number},

    taxGroup: {type:String},
    cgst: { type: Number },
    sgst: { type: Number },
    igst: { type: Number },
    vat: { type: Number },

    cgstAmount: { type: Number },
    sgstAmount: { type: Number },
    igstAmount: { type: Number },
    vatAmount: { type: Number },

    itemTotaltax: {type:Number},

    discountType: {type:String}, //Currency,Percentage
    discountAmount: {type:Number}, 
    itemAmount: {type:Number},

  }, { _id: false });

const SalesOrderSchema = new Schema ({

  organizationId: { type: String, index: true },
  
  customerId: { type: String },
  customerName: { type: String },
  placeOfSupply: { type: String },  
  reference: { type: String },

  salesOrder: { type: String }, //prefix
  //salesPersonId: { type: String }, //next phase
  //salesPersonName: { type: String }, //next phase

  //new
  //shipmentPreference: { type: String },
  //paymentMode: { type: String },
  paymentTerms: { type: String },
  deliveryMethod: { type: String },
  expectedShipmentDate: { type: String },

  salesOrderDate: { type: String },  
  //expiryDate: { type: String },

  //subject: { type: String },
  
  items: [itemsSchema],  
  
  note: { type: String },
  tc: { type: String },

  //new
  otherExpenseAmount: { type: Number },
  otherExpenseReason: { type: String },
  vehicleNumber: { type: String },
  freightAmount: { type: Number },
  roundOffAmount: { type: Number },


  discountTransactionType: { type: String }, // Currency,Percentage
  discountTransactionAmount: { type: Number },
  taxtype: { type: String }, //Intra, Inter, Non-tax, VAT   
  
  subTotal: { type: Number },
  totalItem: { type: Number },

  cgst: { type: Number },
  sgst: { type: Number },
  igst: { type: Number },
  vat: { type: Number },
  totalTax: { type: Number },
  totalAmount: { type: Number },
  totalDiscount: { type: Number },

  status: { type: String },

  createdDate: { type: String },
  userId: { type: String },
  userName: { type: String },
})


const SalesOrder = mongoose.model("SalesOrder", SalesOrderSchema);

module.exports = SalesOrder;



