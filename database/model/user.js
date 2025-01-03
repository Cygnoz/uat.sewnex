// v1.3

const mongoose = require("mongoose");
const { Schema } = mongoose;


const userSchema = new Schema({
  organizationId: { type: String },
  userName: { type: String },
  userNum: { type: String },
  userEmail: { type: String },
  password: { type: String },
  role: { type: String },
  isActive: { type: Boolean, default: true },
    
});

const User = mongoose.model("User", userSchema);

module.exports = User;