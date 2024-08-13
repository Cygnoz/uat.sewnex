const mongoose = require('mongoose');

const debitNoteSchema = new mongoose.Schema({
  organizationId:{
    type:String
  },
  supplier: {
    type: String
  },
  debitnote: {
    type: String
  },
  orderNumber: {
    type: String
  },
  supplierDebitDate: {
    type: Date
  },
  subject: {
    type: String
  },
  warehouse: {
    type: String
  },
  addNotes: {
    type: String
  },
  termsAndConditions: {
    type: String
  },
  createdDate:{
    type:String
  },
  updatedDate:{
    type:String
  }
});

const DebitNote = mongoose.model('DebitNote', debitNoteSchema);
module.exports = DebitNote;
