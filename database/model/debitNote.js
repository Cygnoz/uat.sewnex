const mongoose = require('mongoose');
const { Schema } = mongoose;

const itemTableSchema = new Schema({
 itemProduct:{type:String},
 itemQuantity:{type:String},
 itemRate:{type:String},
 itemTax:{type:String},
 itemDiscount:{type:String},
 itemAmount:{type:String}
})

const debitNoteSchema = new Schema({
  organizationId: { type: String },
  supplier: { type: String },
  debitnote: { type: String },
  orderNumber: { type: String },
  supplierDebitDate: { type: Date },
  subject: { type: String },
  warehouse: { type: String },
  addNotes: { type: String },
  termsAndConditions: { type: String },
  sourceOfSupply: { type: String },
  destinationOfSupply: { type: String },
  bill: { type: String },
  billType: { type: String },
  createdDate: { type: String },
  updatedDate: { type: String },

  itemTable:[itemTableSchema]
});

const DebitNote = mongoose.model('DebitNote', debitNoteSchema);
module.exports = DebitNote;
