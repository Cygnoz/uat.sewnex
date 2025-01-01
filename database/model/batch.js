// v1.1

const mongoose = require("mongoose");
const { Schema } = mongoose;


const batchSchema = new Schema({
    organizationId: {type:String},
    operationId: {type:String},
    transactionId: {type:String}, //Prefix
    action: {type:String}, //Sale, Sale return, Purchase, Purchase Return,Opening Stock, Inventory Adjustment
 
    batchNumber: {type:String},
    itemId: {type:String},
    manufacturingDate: { type: Date, default: () => new Date() },
    expiryDate: { type: Date, default: undefined },
    quantity: {type:Number},
    location: {type:String},
    
    currentStock: {type:Number},
    
    remark: {type:String},

    createdDateTime: { type: Date, default: () => new Date() },

}); 
// , { timestamps: true }
const Batch = mongoose.model("Batch", batchSchema);

module.exports = Batch;