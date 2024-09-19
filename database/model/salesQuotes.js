const mongoose = require('mongoose')
const { Schema } = mongoose

const itemsSchema = new Schema({
    itemName: {type:String},
    quantity: {type:String},
    rate: {type:String},
    tax: {type:String},
    discount: {type:String},
    amount: {type:String},
  }, { _id: false });

const SalesOrderAndQuotesSchema = new Schema ({

    //Customer Details
    salesOrder: { type: String },
    customer: { type: String },

    reference: { type: String },
    salesOrderDate: { type: Date },

    expectedShipmentDate: { type: Date },
    paymentTerms: { type: String },

    deliveryMethod: { type: String },
    salesPerson: { type: String },

    items: [itemsSchema],

    notes: { type: String },
    tc: { type: String },

    //quotes
    salesPerson: { type: String },
    salesQuotesReference: { type: String },
    quote: { type: Number },
    quoteDate: { type: Date },
    expiryDate: { type: Date },
    subject: { type: String },
    addNotes: { type: String },
    addTermsAndConditions: { type: String },

})


const SalesOrderAndQuotes = mongoose.model("SalesOrderAndQuotes", SalesOrderAndQuotesSchema);

module.exports = SalesOrderAndQuotes;



