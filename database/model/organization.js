// v1.3

const mongoose = require("mongoose");
const { Schema } = mongoose;


const organizationSchema = new Schema({
  organizationId: { type: String },
  organizationName: { type: String },
  organizationLogo: { type: String },

  primaryContactName: { type: String },
  primaryContactNum: { type: String },
  primaryContactEmail: { type: String },
  
  organizationCountry: { type: String },
  organizationIndustry: { type: String },

  
  //address
  addline1: { type: String },
  addline2: { type: String },
  city: { type: String },
  pincode: { type: String },
  state: { type: String },
  
  organizationPhNum: { type: String },
  website: { type: String },
  
  baseCurrency: { type: String },
  fiscalYear: { type: String },
  
  timeZone: { type: String },
  timeZoneExp: { type: String },
  dateFormat: { type: String },
  dateFormatExp: { type: String },
  dateSplit: { type: String },
  
  startDate: { type: String },
  endDate: { type: String },

  isActive: { type: Boolean, default: true },
  
  createdDateTime: { type: Date, default: () => new Date() },

}, { versionKey: false }); 

const Organization = mongoose.model("Organization", organizationSchema);

module.exports = Organization;




