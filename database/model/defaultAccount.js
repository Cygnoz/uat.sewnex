// v1.2

const mongoose = require("mongoose");
const { Schema } = mongoose;


const defaultAccountSchema = new Schema({
    organizationId: {type:String},

    salesDiscountAccount: {type: mongoose.Schema.Types.ObjectId, ref: 'Accounts'},
    purchaseDiscountAccount: {type: mongoose.Schema.Types.ObjectId, ref: 'Accounts'},

    outputCgst: {type: mongoose.Schema.Types.ObjectId, ref: 'Accounts'},
    outputSgst: {type: mongoose.Schema.Types.ObjectId, ref: 'Accounts'},
    outputIgst: {type: mongoose.Schema.Types.ObjectId, ref: 'Accounts'},
    outputVat: {type: mongoose.Schema.Types.ObjectId, ref: 'Accounts'},

    inputCgst: {type: mongoose.Schema.Types.ObjectId, ref: 'Accounts'},
    inputSgst: {type: mongoose.Schema.Types.ObjectId, ref: 'Accounts'},
    inputIgst: {type: mongoose.Schema.Types.ObjectId, ref: 'Accounts'},
    inputVat: {type: mongoose.Schema.Types.ObjectId, ref: 'Accounts'}

});

const defaultAccount = mongoose.model("DefaultAccount", defaultAccountSchema);

module.exports = defaultAccount;