//v1.2

const mongoose = require('mongoose')
const { Schema } = mongoose

const itemsSchema = new Schema({

    itemId: {type: mongoose.Schema.Types.ObjectId, ref: 'Item'},
    //itemName
    
    quantity: {type:Number},
    sellingPrice: {type:Number},

    taxPreference: {type:String},
    taxGroup: {type:String},
    cgst: { type: Number },
    sgst: { type: Number },
    igst: { type: Number },
    vat: { type: Number },

    cgstAmount: { type: Number },
    sgstAmount: { type: Number },
    igstAmount: { type: Number },
    vatAmount: { type: Number },

    itemTotalTax: {type:Number},

    discountType: {type:String}, //Currency,Percentage
    discountAmount: {type:Number}, 
    itemAmount: {type:Number},

  }, { _id: false });

const SalesQuotesSchema = new Schema ({

  organizationId: { type: String, index: true },
  
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  //customerName
  placeOfSupply: { type: String },  
  reference: { type: String },

  salesQuotes: { type: String }, //prefix
  //salesPersonId: { type: String }, //next phase
  //salesPersonName: { type: String }, //next phase

  taxPreference: {type: String}, //Taxable / Non-Taxable
  taxType: { type: String }, //Intra, Inter, Non-tax, VAT   

  salesQuoteDate: { type: String },  
  expiryDate: { type: String },

  subject: { type: String },
  
  items: [itemsSchema],  
  
  note: { type: String },
  tc: { type: String },


  discountTransactionType: { type: String }, //Currency,Percentage
  discountTransactionAmount: { type: Number },
  
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

  createdDateTime: { type: Date, default: () => new Date() },
  userId: { type: String },
  userName: { type: String },
})


const SalesQuotes = mongoose.model("SalesQuotes", SalesQuotesSchema);

module.exports = SalesQuotes;



