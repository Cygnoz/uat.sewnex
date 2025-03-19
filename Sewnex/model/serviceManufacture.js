// v1.1

const mongoose = require("mongoose");
const { Schema } = mongoose;


const serviceManufactureSchema = new Schema({

    organizationId: { type: String },

    orderServiceId: {type: mongoose.Schema.Types.ObjectId, ref: 'SewnexOrderService'},

    status:{ type: String },

    staffId: {type: mongoose.Schema.Types.ObjectId, ref: 'Staff'},

    manufacturingStatus:{ type: String },

    startDate:{ type: String },
    startTime:{ type: String },
    endDate:{ type: String },
    endTime:{ type: String },

    rate:{ type: String }
});

const ServiceManufacture = mongoose.model("ServiceManufacture", serviceManufactureSchema);

module.exports = ServiceManufacture;