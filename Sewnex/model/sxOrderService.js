//v1.0

const mongoose = require('mongoose')
const { Schema } = mongoose


const SewnexOrderServiceSchema = new Schema ({

    organizationId: { type: String, index: true },
    
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'service' },
    //serviceName

    fabric: [

      {
        itemId: {type: mongoose.Schema.Types.ObjectId, ref: 'Item'},
        //itemName

        quantity: {type:Number},
        returnQuantity: { type: Number, default: 0 }, 
        sellingPrice: {type:Number},

        taxPreference: {type:String},
        taxGroup: {type:String},
        cgst: { type: Number },
        sgst: { type: Number },
        igst: { type: Number },
        vat: { type: Number },

        cgstAmount: { type: Number },
        sgstAmount: { type: Number },
        igstAmount: { type: Number },
        vatAmount: { type: Number },

        itemTotalTax: {type:Number},

        itemAmount: {type:Number},
        salesAccountId: {type:String}

      }
    ],  

    measurement: [
     { 
      parameterId: {type: mongoose.Schema.Types.ObjectId, ref: 'CPS'},
      //parameterName  
      value: {type:Number}
     }
    ],

    style: [
      {
        styleId: {type: mongoose.Schema.Types.ObjectId, ref: 'CPS'},
        //styleName
        styleRate: { type: Number },
      }
    ],
  
    referenceImage: [
      {
        imageUrl: {type:String}
      }
    ],
    
    
    trialDate: { type: String },

    deliveryDate: { type: String }, 
    requiredWorkingDay: { type: Number }, 

    serviceRate: { type: Number },
    fabricRate: { type: Number },
    styleRate: { type: Number },

    status: { type: String, default: 'Pending' },
    createDateTime: { type: Date, default: Date.now },
    
  })
  
  
  const SewnexOrderService = mongoose.model("SewnexOrderService", SewnexOrderServiceSchema);
  
  module.exports = SewnexOrderService;