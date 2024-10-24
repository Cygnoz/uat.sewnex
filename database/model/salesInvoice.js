const mongoose = require('mongoose')
const { Schema } = mongoose

const itemsSchema = new Schema({

    itemId: {type:String},
    itemName: {type:String},

    quantity: {type:String},
    sellingPrice: {type:Number},

    taxGroup: {type:String},
    cgst: { type: Number },
    sgst: { type: Number },
    igst: { type: Number },
    vat: { type: Number },
    itemTotaltax: {type:Number},

    discountType: {type:String}, //Currency,Percentage
    discountAmopunt: {type:Number}, 
    itemAmount: {type:Number},

  }, { _id: false });

const SalesInvoiceSchema = new Schema ({

  organizationId: { type: String, index: true },
  
  customerId: { type: String },
  customerName: { type: String },
  placeOfSupply: { type: String },  
  reference: { type: String },

  salesInvoice: { type: String }, //prefix
  //salesPersonId: { type: String }, //next phase
  //salesPersonName: { type: String }, //next phase
  
  //new
  paymentTerms: { type: String },
  deliveryMethod: { type: String },
  expectedShipmentDate: { type: String },

  salesInvoiceDate: { type: String },  
  expiryDate: { type: String },

  // subject: { type: String },
  
  items: [itemsSchema],  
  
  note: { type: String },
  tc: { type: String },


  discountTransactionType: { type: String }, // Currency,Percentage
  discountTransactionAmount: { type: Number },
  taxtype: { type: String },//Intra, Inter, Non-tax, VAT 

  
  
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


const SalesInvoice = mongoose.model("SalesInvoice", SalesInvoiceSchema);

module.exports = SalesInvoice;



