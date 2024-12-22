// v1.1

const mongoose = require("mongoose");
const { Schema } = mongoose;


const trialBalanceSchema = new Schema({
    organizationId: {type:String},
    operationId: {type:String},
    transactionId: {type:String}, //prefix
    
    accountId: {type:String},
    accountName: {type:String},
    
    action: {type:String},
    
    debitAmount: {type:Number},
    creditAmount: {type:Number},
    remark: {type:String},

    createdDateTime: { type: Date, default: () => new Date() },
});

const TrialBalances = mongoose.model("TrialBalances", trialBalanceSchema);

module.exports = TrialBalances;