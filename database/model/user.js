// v1.0

const mongoose = require("mongoose");
const { Schema } = mongoose;


const userSchema = new Schema({
  organizationName: { type: String },
  organizationId: { type: String },
  userName: { type: String },
  userNum: { type: String },
  userEmail: { type: String },
  password: { type: String },
  role: { type: String },
    
});

userSchema.index({ organizationId: 1, userEmail: 1 });

const User = mongoose.model("User", userSchema);

module.exports = User;