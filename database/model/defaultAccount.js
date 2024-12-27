// v1.2

const mongoose = require("mongoose");
const { Schema } = mongoose;


const defaultAccountSchema = new Schema({
    organizationId: {type:String},

    salesDiscountAccount: {type:String},
    purchaseDiscountAccount: {type:String},

    outputCgst: {type:String},
    outputSgst: {type:String},
    outputIgst: {type:String},
    outputVat: {type:String},

    inputCgst: {type:String},
    inputSgst: {type:String},
    inputIgst: {type:String},
    inputVat: {type:String}

});

const defaultAccount = mongoose.model("DefaultAccount", defaultAccountSchema);

module.exports = defaultAccount;