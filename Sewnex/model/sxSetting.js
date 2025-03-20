// v1.1

const mongoose = require("mongoose");
const { Schema } = mongoose;


const sxSettingSchema = new Schema({

    organizationId: { type: String },

    datePreference: { type: String }, //Order Wise/Item Wise

    orderTax:{ type: String },//Taxable/Non-Taxable

    orderFabric:{type:Boolean},//true - include fabric in order, false - exclude fabric from order

    orderStatus:[{
        orderStatusName: { type: String },
        _id: false
    }],

    manufacturingStatus:[{
        manufacturingStatusName: { type: String },
        _id: false
    }],

    measuringStaff:{type:Boolean},//true - include measuring Staff in order, false - exclude measuring Staff from order

});

const SewnexSetting = mongoose.model("SewnexSetting", sxSettingSchema);

module.exports = SewnexSetting;