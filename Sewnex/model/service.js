// v1.0

const mongoose = require('mongoose');
const { Schema } = mongoose;



const parameterSchema = new Schema({
    parameterId: {type: mongoose.Schema.Types.ObjectId, ref: 'CPS'},
    //parameterName  
}, { _id: false });



const styleSchema = new Schema({
    styleId: {type: mongoose.Schema.Types.ObjectId, ref: 'CPS'},
    //styleName
    styleRate: { type: Number },

}, { _id: false });



const serviceSchema = new mongoose.Schema({
    organizationId: { type: String},

    serviceName: { type: String},
    serviceImage: { type: String},

    categoryId:{ type: mongoose.Schema.Types.ObjectId, ref: 'CPS' }, 
    //Category Name
    
    unit: { type: String },
    hsnSac: { type: String },
    costPrice: { type: String },

    sellingPrice: { type: Number }, //rate
    salesAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Accounts' },

    taxRate:{type:String},  //Gst5
    cgst:{type:Number},
    sgst:{type:Number},
    igst:{type:Number},
    vat:{type:Number},

    parameter: [parameterSchema],

    style: [styleSchema],

    //styleTotal:{type:Number},
    //amountIs:{type:String},   // Inclusive, Exclusive
    //serviceCharge:{type:Number},
    //styleAmount:{type:Number},
    //serviceAmount:{type:Number},
    //grandTotal:{type:Number},
});

const Service = mongoose.model('Service', serviceSchema);
module.exports = Service;

