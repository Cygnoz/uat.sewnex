const mongoose = require("mongoose");
const { Schema } = mongoose;
 

const serviceSchema = new Schema({
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
    //serviceName
    price: { type : Number },
    count: { type : Number },
}, { _id: false });


const membershipPlanSchema = new Schema({
    organizationId: { type: String, index: true },
    planName: { type : String },
    description: { type : String },

    planType: { type : String },    //Currency / Percentage
    discount: { type : Number },    //amount / percentage rate
    duration: { type : String },    // 2 years

    services: [serviceSchema],

    actualRate: { type : Number },
    sellingPrice: { type : Number },

    createdDateTime: { type: Date, default: () => new Date() },
    
    //lastModifiedDate
    lastModifiedDate:{type: Date},
    
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});
 

const MembershipPlan = mongoose.model("MembershipPlan", membershipPlanSchema);
module.exports = MembershipPlan;