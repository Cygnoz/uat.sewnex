const mongoose = require('mongoose')
const { Schema } = mongoose



const SalesOrderAndQuotesSchema = new Schema ({

    salesOrder: { type: String },
    selectCustomer: { type: String },
    salesOrderReference: { type: String },
    salesOrderDate: { type: Date },
    expectedShipmentDate: { type: Date },
    paymentTerms: { type: String },
    deliveryMethod: { type: String },
    salesPerson: { type: String },
    salesOrderAddNotes: { type: String },
    salesOrderTermsAndConditions: { type: String },

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