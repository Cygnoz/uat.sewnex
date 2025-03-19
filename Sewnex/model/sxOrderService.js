//v1.0

const mongoose = require('mongoose')
const { Schema } = mongoose


const SewnexOrderServiceSchema = new Schema ({

    organizationId: { type: String, index: true },
    
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
    //serviceName

    orderId: {type:String},

    fabric: [
      {
        itemId: {type: mongoose.Schema.Types.ObjectId, ref: 'Item'},
        //itemName

        quantity: {type:Number},
        returnQuantity: { type: Number, default: 0 }, 
        sellingPrice: {type:Number},

        taxPreference: {type:String},
        taxRate: {type:String},
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
        taxPreference: {type:String},
        taxRate: {type:String},
        cgst: { type: Number },
        sgst: { type: Number },
        igst: { type: Number },
        vat: { type: Number },
        cgstAmount: { type: Number },
        sgstAmount: { type: Number },
        igstAmount: { type: Number },
        vatAmount: { type: Number },
        styleTax: { type: Number },
        styleAmount: {type:Number}
      }
    ],
  


    referenceImage: [
      {
        imageUrl: {type:String}
      }
    ],
    



    cgst: { type: Number },
    sgst: { type: Number },
    igst: { type: Number },
    vat: { type: Number },
    taxRate: { type: String },
    cgstService: { type: Number },
    sgstService: { type: Number },
    igstService: { type: Number },
    vatService: { type: Number },
    
    trialDate: { type: String },
    deliveryDate: { type: String }, 
    requiredWorkingDay: { type: Number }, 

    serviceRate: { type: Number },
    serviceTax: { type: Number },
    serviceAmount: { type: Number },

    fabricRate: { type: Number },
    fabricTax: { type: Number },

    styleRate: { type: Number },
    styleTax: { type: Number },

    totalRate: { type: Number },
    totalTax: { type: Number },

    //Tax
    cgstAmount: { type: Number },
    sgstAmount: { type: Number },
    igstAmount: { type: Number },
    vatAmount: { type: Number },

    itemTotal: { type: Number },

    status: { type: String, default: 'Order Placed' },
    
    createDateTime: { type: Date, default: Date.now },
    
  })
  
  
  const SewnexOrderService = mongoose.model("SewnexOrderService", SewnexOrderServiceSchema);
  
  module.exports = SewnexOrderService;