
const mongoose = require('mongoose');

const cpsSchema = new mongoose.Schema({
    organizationId: { type: String, index: true },
    type: { type: String },
    name: { type: String },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'CPS' },
    price: { type: Number },
    description: { type: String },
    uploadImage: { type: String },
    createdDateTime: { type: Date, default: () => new Date() },
    lastModifiedDate: { type: Date },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const CPS = mongoose.model('CPS', cpsSchema);
module.exports = CPS;