// v1.0

const mongoose = require('mongoose');
const { Schema } = mongoose;

const gstTaxRateSchema = new Schema({
  taxName: { type: String },
  taxRate: { type: Number },
  cgst: { type: Number },
  sgst: { type: Number },
  igst: { type: Number },
});



const vatTaxRateSchema = new Schema({
  taxName: { type: String },
  taxRate: { type: Number },
});



const taxSchema = new mongoose.Schema({
  //Base
  organizationId: { type: String },
  taxType: { type: String }, //GST or VAT

  //GST
  gstIn: { type: String },
  gstBusinesLegalName: { type: String },
  gstBusinessTradeName: { type: String },
  gstRegisteredDate: { type: String },
  gstTaxRate: [gstTaxRateSchema],
  compositionSchema: { type: String },//boolean
  compositionPercentage: { type: String },



  //VAT
  vatNumber: { type: String },
  vatBusinesLegalName: { type: String },
  vatBusinessTradeName: { type: String },
  vatRegisteredDate: { type: String },
  tinNumber: { type: String },
  vatTaxRate: [vatTaxRateSchema],


  //MSME
  msmeType: { type: String },
  msmeRegistrationNumber: { type: String },
});

module.exports = mongoose.model('Tax', taxSchema);