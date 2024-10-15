const mongoose = require("mongoose");
const { Schema } = mongoose;


const itemTrackSchema = new Schema({
    organizationId: {type:String},
    operationId: {type:String},
    transactionId: {type:String}, //Prefix
    action: {type:String}, //Sale, Sale return, Purchase, Purchase Return,Opening Stock, Inventory Adjustment
 
    date: {type:String},

    itemId: {type:String},
    itemName: {type:String},

    creditQuantity: {type:Number},
    debitQuantity: {type:Number},

    currentStock: {type:Number},
    
    remark: {type:String},
});

const ItemTrack = mongoose.model("ItemTrack", itemTrackSchema);

module.exports = ItemTrack;