// v1.0

const mongoose = require("mongoose");
const { Schema } = mongoose;


const transactionSchema = new Schema({
    accountId: { type: String },
    accountName: { type: String },
    creditAmount: { type: Number },
    debitAmount: { type: Number },
    description: { type: String },
    contact: { type: String },
  }, { _id: false });


const journalSchema = new Schema({
    organizationId: {type:String},
    journalId: {type:String},
    date: {type:String},
    entryDate: {type:String},
    reference: {type:String},
    note: {type:String},
    cashBasedJournal: {type:String},
    currency: {type:String},
    transaction: [transactionSchema],
    totalDebitAmount: {type:Number},
    totalCreditAmount: {type:Number},

});

const Journal = mongoose.model("Journals", journalSchema);

module.exports = Journal;