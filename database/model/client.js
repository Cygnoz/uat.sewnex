// v1.1

const mongoose = require("mongoose");
const { Schema } = mongoose;


const clientSchema = new Schema({
  organizationId: { type: String },
  contactName: { type: String },
  contactNum: { type: String },
  email: { type: String },    
});

const Client = mongoose.model("Client", clientSchema);

module.exports = Client;




