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
    // costPrice: { type: String },

    taxType:{type:String},   // Inclusive, Exclusive
    taxRate:{type:String},  //Gst5
    cgst:{type:Number}, 
    sgst:{type:Number}, 
    igst:{type:Number}, 
    vat:{type:Number},

    styleTotal:{type:Number},
    serviceCharge:{type:Number},
    sellingPrice: { type: Number }, //final amount (without tax) 
    salesAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Accounts' },

    grandTotal: { type: Number },

    parameter: [parameterSchema],

    style: [styleSchema],

});

const Service = mongoose.model('Service', serviceSchema);
module.exports = Service;

