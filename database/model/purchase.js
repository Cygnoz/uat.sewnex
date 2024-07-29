const mongoose = require('mongoose')
const purchaseSchema = new mongoose.Schema({

    supplier: {
        type: String,
      },
      deliveryAddress: {
        type: String,
      },
      customer: {
        type: String,
      },
      purchaseOrderReference: {
        type: String,
      },
      warehouse: {
        type: String
      },
      purchaseOrder: {
        type: String,
      },
      purchaseOrderDate: {
        type: Date,
      },
      expectedShipmentDate: {
        type: Date,
      },
      paymentTerms: {
        type: String,
      },
      purchaseOrderAddNotes: {
        type: String
      },
      purchaseOrderTermsAndConditions: {
        type: String
      },
      paymentDate: {
        type: Date,
      },
      paymentMade: {
        type: Number,
      },
      paymentId: {
        type: String,
      },
      paymentMode: {
        type: String,
      },
      paidThrough: {
        type: String,
      },
      paymentMadeReference: {
        type: String
      },
      paymentMadeNotes: {
        type: String
      },
      paymentMadeAttachments: {
        type: String
      },
      debitNote: {
        type: String,
      },
      orderNumber: {
        type: String,
      },
      supplierDebitDate: {
        type: Date,
        required: true
      },
      subject: {
        type: String,
        required: true
      },
      warehouse: {
        type: String,
        required: true
      },
      debitNoteAddNotes: {
        type: String
      },
      debitNoteTermsAndConditions: {
        type: String
      },
      debitNoteAttachments: {
        type: String
      }
})
const Purchase = mongoose.model('purchase',purchaseSchema)
module.exports = Purchase