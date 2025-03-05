// v1.0

const mongoose = require("mongoose");
const { Schema } = mongoose;


const staffSchema = new Schema({
  organizationId: { type: String },

  staffImage: { type: String },
  staffName: { type: String },
  gender: { type: String },

  contactNumber: { type: String },
  email: { type: String },
  address: { type: String },

  enablePortal: { type: Boolean },
  password: { type: String },
  
  dob: { type: String },
  doj: { type: String },
  
  uploadDocument: { type: String },

  department: { type: String }, //role
  
  workType: { type: String },
  
  domainDesignation: { type: String },

  salaryType: { type: String },//Monthly , per week

  service:[{
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
  }], 
});

const Staff = mongoose.model("Staff", staffSchema);

module.exports = Staff;