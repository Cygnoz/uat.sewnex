
// v1.2

const mongoose = require("mongoose");
const { Schema } = mongoose;


const accountSchema = new Schema({
    organizationId: {type:String},
    accountName: {type:String},
    accountCode: {type:String},
    accountId: {type:String},
    accountSubhead: {type:String},
    accountHead: {type:String},
    accountGroup: {type:String},
    
    description: {type:String},
    
    bankAccNum: {type:String},
    bankIfsc: {type:String},
    bankCurrency: {type:String},
    
    createdDateTime: { type: Date, default: () => new Date() },
});

const Accounts = mongoose.model("Accounts", accountSchema);

module.exports = Accounts;