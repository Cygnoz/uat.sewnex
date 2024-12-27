// v1.2

const mongoose = require("mongoose");
const { Schema } = mongoose;


const transactionSchema = new Schema({
    accountId: { type: String },
    creditAmount: { type: Number },
    debitAmount: { type: Number },
    description: { type: String },
    contact: { type: String },
  }, { _id: false });


const journalSchema = new Schema({
    organizationId: {type:String},
    journalId: {type:String}, //prefix
    date: {type:String},
    reference: {type:String},
    note: {type:String},
    cashBasedJournal: {type:String},
    currency: {type:String},
    
    transaction: [transactionSchema],
    
    totalDebitAmount: {type:Number},
    totalCreditAmount: {type:Number},
    
    createdDateTime: { type: Date, default: () => new Date() },
});

const Journal = mongoose.model("Journals", journalSchema);

module.exports = Journal;