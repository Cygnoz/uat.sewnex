const mongoose = require("mongoose");
const { Schema } = mongoose;

// const addressSchema = new Schema({
//   addline1: { type: String },
//   addline2: { type: String },
//   city: { type: String },
//   pincode: { type: String },
//   state: { type: String },
// }, { _id: false });

const addfieldSchema = new Schema({
  label: { type: String },
  value: { type: String },
}, { _id: false });

// const bankSchema = new Schema({
//   accountHolderName: { type: String },
//   bankName: { type: String },
//   accNum: { type: String },
//   ifsc: { type: String },
// }, { _id: false });

const organizationSchema = new Schema({
  organizationId: { type: String },
  organizationLogo: { type: String },
  organizationName: { type: String },

  organizationCountry: { type: String },
  organizationIndustry: { type: String },

  //address: [addressSchema]
  addline1: { type: String },
  addline2: { type: String },
  city: { type: String },
  pincode: { type: String },
  state: { type: String },
  
  organizationPhNum: { type: String },
  website: { type: String },

  baseCurrency: { type: String },
  fiscalYear: { type: String },
  reportBasis: { type: String },

  language: { type: String },
  timeZone: { type: String },
  dateFormat: { type: String },
  dateSplit: { type: String },

  companyId: { type: String },
  companyIdField: { type: String },
  taxId: { type: String },
  taxIdField: { type: String },

  addfield: [addfieldSchema],
  
  qrLocation: { type: String },
  qrSignature: { type: String },

  twitter: { type: String },
  insta: { type: String },
  linkedin: { type: String },
  facebook: { type: String },

  //bankfield: [bankSchema],
  accountHolderName: { type: String },
  bankName: { type: String },
  accNum: { type: String },
  ifsc: { type: String },
});

const Organization = mongoose.model("Organization", organizationSchema);

module.exports = Organization;




