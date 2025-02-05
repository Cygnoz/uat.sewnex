// v1.5

const mongoose = require("mongoose");
const { Schema } = mongoose;


const accountSchema = new Schema({
    organizationId: {type:String},
    accountName: {type:String}, 
    accountCode: {type:String},
    accountId: {type: mongoose.Schema.Types.ObjectId, ref: 'Accounts'},

    accountSubhead: {type:String},
    accountHead: {type:String},
    accountGroup: {type:String},

    parentAccountId: {type: mongoose.Schema.Types.ObjectId, ref: 'Accounts'},

    description: {type:String},

    //Opening Balance
    debitOpeningBalance: {type:Number},
    creditOpeningBalance: {type:Number},

    bankAccNum: {type:String},
    bankIfsc: {type:String},
    bankCurrency: {type:String},

    systemAccounts: { type: Boolean }, // false: edit and deletable(non - system accounts), true: non-edit and non-deletable(system accounts)

    createdDateTime: { type: Date, default: () => new Date() },

});

const Accounts = mongoose.model("Accounts", accountSchema);

module.exports = Accounts;