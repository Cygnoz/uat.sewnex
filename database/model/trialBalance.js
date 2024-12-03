// v1.0

const mongoose = require("mongoose");
const { Schema } = mongoose;


const trialBalanceSchema = new Schema({
    organizationId: {type:String},
    operationId: {type:String},
    transactionId: {type:String},

    date: {type:String},

    accountId: {type:String},
    accountName: {type:String},

    action: {type:String},
    
    debitAmount: {type:Number},
    creditAmount: {type:Number},
    remark: {type:String},
});

const TrialBalances = mongoose.model("TrialBalances", trialBalanceSchema);

module.exports = TrialBalances;