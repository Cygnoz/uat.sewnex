const mongoose = require('mongoose')

const { Schema } = mongoose

const addItemSchema =new Schema({
   product:{type:String},
   quantity:{type:String},
   rate:{type:String},
   tax:{type:String},
   discount:{type:String},
   amount:{type:String}
})


const purchaseSchema = new Schema({

  organizationId:{
     type:String
  },
  orderId:{
     type:String
  },
  deliveryAddress: {
    type: String,
  },
  customer: {
    type: String
  },
  warehouse: {
    type:String
  },
  customer:{
    type:String
  },
  warehouseToBeUpdated:{
  type:String
  },
  reference: {
    type: String,
  },
  shipmentPreference: {
    type: String,
  },
  purchaseOrderDate: {
    type: Date,
  },
  expectedShipmentDate: {
    type: Date,
  },
  paymentTerms: {
    type: String,
  },
  addNotes:{
    type:String
  },
  termsAndConditions:{
    type:String
  },
  createdDate:{
    type:String
  },
  updatedDate:{
    type:String
  },

  purchaseOrder : [addItemSchema]

})
const PurchaseOrder = mongoose.model('purchase',purchaseSchema)
module.exports = PurchaseOrder