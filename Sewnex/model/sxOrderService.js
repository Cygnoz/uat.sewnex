//v1.0

const mongoose = require('mongoose')
const { Schema } = mongoose


const SewnexOrderServiceSchema = new Schema ({

    organizationId: { type: String, index: true },
    
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'service' },
    //serviceName

    fabric: [fabricSchema],  

    measurement: [measurementSchema],

    style: [styleSchema],
  
    referenceImage: [referenceImageSchema],
    
    
    trialDate: { type: String },
    deliveryDate: { type: String }, 
    requiredWorkingDay: { type: Number }, 
  
  })
  
  
  const SewnexOrderService = mongoose.model("SewnexOrderService", SewnexOrderServiceSchema);
  
  module.exports = SewnexOrderService;