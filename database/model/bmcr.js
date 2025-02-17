// v1.0

const mongoose = require('mongoose');

const bmcrSchema = new mongoose.Schema({
    organizationId: { type: String},
    type: { type: String},
    brandName: { type: String },
    manufacturerName: { type: String },
    categoriesName: { type: String },
    rackName: { type: String },
    description: { type: String },

    // sewnex variable
    uploadImage: { type: String }
});

const BMCR = mongoose.model('BMCR', bmcrSchema);
module.exports = BMCR;