// v1.0

const mongoose = require("mongoose");
const { Schema } = mongoose;


const staffSchema = new Schema({
  organizationId: { type: String },

  staffName: { type: String },
  staffImage: { type: String },
  gender: { type: String },
  contact: { type: String },

  email: { type: String },
  password: { type: String },

  address: { type: String },
  dob: { type: String },
  doj: { type: String },

  proofImage: { type: String },

  department: { type: String },
  workType: { type: String },//role

  designation: { type: String },

  paymentType: { type: String },//Monthly , per week
  salary: { type: String }

  // service: { type: String }, 
});

const Staff = mongoose.model("Staff", staffSchema);

module.exports = Staff;