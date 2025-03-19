//v1.0

const mongoose = require('mongoose')
const { Schema } = mongoose

const serviceSchema = new Schema({

  orderServiceId: {type: mongoose.Schema.Types.ObjectId, ref: 'SewnexOrderService'},
  }, { _id: false });



const InternalOrderSchema = new Schema ({

  organizationId: { type: String, index: true },
  
  designerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  //staffsName

  internalOrder: { type: String }, //prefix
  internalOrderDate: { type: String },
  
  service: [serviceSchema],
  
  // productId: { type: String },

  editLimit: {type: Boolean, default: true},   // true - before taxation file date  |  false - after taxation file date

  createDateTime: { type: Date, default: Date.now },

  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  //userName

})


const InternalOrder = mongoose.model("InternalOrder", InternalOrderSchema);

module.exports = InternalOrder;



