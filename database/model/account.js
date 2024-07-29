const mongoose = require("mongoose");
const { Schema } = mongoose;


const accountSchema = new Schema({
    organizationId: {type:String},
    accountName: {type:String},
    accountCode: {type:String},
    accountType: {type:String},
    accountGroup: {type:String},
    accountHeads: {type:String},
    openingBalance: {type:Number},
    openingBalanceDate: {type:String},
    description: {type:String},

    bankAccNum: {type:String},
    bankIfsc: {type:String},
    bankCurrency: {type:String},
});

const Accounts = mongoose.model("Accounts", accountSchema);

module.exports = Accounts

;




