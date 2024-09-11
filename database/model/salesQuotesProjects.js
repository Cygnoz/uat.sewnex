const mongoose = require('mongoose');
const { Schema } = mongoose

const quotesSchema = new mongoose.Schema({
  salesPerson: { type: String },
  salesQuotesReference: { type: String },
  quote: { type: Number },
  quoteDate: { type: Date },
  expiryDate: { type: Date },
  subject: { type: String },
  addNotes: { type: String },
  addTermsAndConditions: { type: String },
});
const 

module.exports = mongoose.model('Quotes', quotesSchema);
