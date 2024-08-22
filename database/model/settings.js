const mongoose = require("mongoose");
const { Schema } = mongoose;

const shipSchema = new Schema({
  shipAttention: { type: String },
  shipStreet1: { type: String },
  shipStreet2: { type: String },
  shipCity: { type: String },
  shipState: { type: String },
  shipZip: { type: String },
  shipCountry: { type: String },
  shipPhone: { type: String },
  status: { type: Boolean }
});


const settingSchema = new Schema({
  organizationId: {type:String},

  //Invoice
  organizationAddressFormat: { type: String },

  qrLocation: { type: String },  displayQrLocation: { type: Boolean },
  qrPayment: { type: String },  displayQrPayment: { type: Boolean },
  digitalSignature: { type: String },  displayDigitalSignature: { type: Boolean },
  xLink: { type: String },  displayXLink: { type: Boolean },
  instagramLink: { type: String },  displayInstagramLink: { type: Boolean },
  linkedinLink: { type: String },  displayLinkedinLink: { type: Boolean },
  facebookLink: { type: String },  displayFacebookLink: { type: Boolean },
  
  //Bankfield
  accountHolderName: { type: String },  displayAccountHolderName: { type: Boolean },
  bankName: { type: String },  displayBankName: { type: Boolean },
  accNum: { type: String },  displayAccNum: { type: Boolean },
  ifsc: { type: String }, displayIfsc: { type: Boolean },

  defaultTermsAndCondition: { type: String },

  //Item
  itemDecimal: { type: String },
  itemDimensions: { type: String },
  itemWeights: { type: String },
  barcodeScan: { type: String },

  itemDuplicateName: { type: Boolean }, //default:false
  hsnSac: { type: Boolean }, //default:false
  hsnDigits: { type: String }, // 4, 6

  priceList: { type: Boolean }, //default:false
  priceListAtLineLevel: { type: Boolean }, //default:false

  compositeItem: { type: Boolean }, //default:false

  stockBelowZero: { type: Boolean }, //default:false
  outOfStockBelowZero : { type: Boolean }, //default:false
  notifyReorderPoint: { type: Boolean }, //default:false
  trackCostOnItems: { type: Boolean }, //default:false



  //Sales Order
  salesOrderAddress: { type: Boolean },//deafult=false
  salesOrderCustomerNote: { type: Boolean },//deafult=false
  salesOrderTermsCondition: { type: Boolean },//deafult=false
  salesOrderClose: { type: String }, //default=invoice    (invoice, shipment, shipmentAndInvoice)
  restrictSalesOrderClose: { type: Boolean }, //deafult=false
  termCondition: { type: String },
  customerNote: { type: String },


  //Shipment
  carrierNotification: { type: Boolean }, //deafult=false
  manualNotification: { type: Boolean }, //deafult=false
  shippingAddress:[shipSchema],


  //Invoice
  invoiceEdit: { type: String },
  displayExpenseReceipt: { type: String },
  salesOrserNumber: { type: Boolean }, //default=true  true=sales order number   false = Sales Order Reference Number
  paymentReceipt: { type: Boolean },//default= false
  invoiceQrCode: { type: Boolean },//default= false
  invoiceQrType: { type: String },
  invoiceQrDescription: { type: String },
  zeroValue: { type: Boolean },
  salesInvoiceTC: { type: String },
  salesInvoiceCN: { type: String },


  //Delivery Chellans
  deliveryChellanTC: { type: String },
  deliveryChellanCN: { type: String },


  //Credit Note
  overideCostPrice: { type: Boolean },//default=false
  creditNoteQr: { type: Boolean },//default=false
  creditNoteQrType: { type: String },
  creditNoteQrDespriction: { type: String },
  recordLocking: { type: Boolean },//default=false
  creditNoteTC: { type: String },
  creditNoteCN: { type: String },

  //Purchase order
  purchaseOrderClose: { type: String }, // Purchase recorder, Bill created, Purchase & Bill recorded
  purchaseTC: { type: String },
  purchaseNote: { type: String },


});

const Settings = mongoose.model("Settings", settingSchema);

module.exports = Settings;