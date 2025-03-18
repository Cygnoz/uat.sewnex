
const mongoose = require('mongoose');
const { Schema } = mongoose


const statusSchema = new Schema({
    status: { type: String },
    date: { type: String },
}, { _id: false });

const orderStatusSchema = new mongoose.Schema({
    organizationId: { type: String, index: true },

    orderServiceId: {type: mongoose.Schema.Types.ObjectId, ref: 'SewnexOrderService'},

    status: [statusSchema],
    
    remarks: { type: String },

    createdDateTime: { type: Date, default: () => new Date() },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const OrderStatus = mongoose.model('OrderStatus', orderStatusSchema);
module.exports = OrderStatus;