const mongoose = require('mongoose')
const { Schema } = mongoose

const itemsSchema = new Schema({
    itemName: {type:String},
    quantity: {type:String},
    rate: {type:String},
    tax: {type:String},
    discount: {type:String},
    amount: {type:String},
  }, { _id: false });

const SalesOrderAndQuotesSchema = new Schema ({

    //Customer Details
    salesOrder: { type: String },
    customer: { type: String },

    reference: { type: String },
    salesOrderDate: { type: Date },

    expectedShipmentDate: { type: Date },
    paymentTerms: { type: String },

    deliveryMethod: { type: String },
    salesPerson: { type: String },

    items: [itemsSchema],

    notes: { type: String },
    tc: { type: String },

    //quotes
    salesPerson: { type: String },
    salesQuotesReference: { type: String },
    quote: { type: Number },
    quoteDate: { type: Date },
    expiryDate: { type: Date },
    subject: { type: String },
    addNotes: { type: String },
    addTermsAndConditions: { type: String },

})


const SalesOrderAndQuotes = mongoose.model("SalesOrderAndQuotes", SalesOrderAndQuotesSchema);

module.exports = SalesOrderAndQuotes;




invoiceNumber
billGeneratedDate
taxable
paymentMode
customerId
customerName
customerMobile
customerCard
customerState
grossAmount
discount
sgst
cgst
igst
vat
taxAmount
invoiceAmount
paidAmount
balance
billCashback
currentTotalCashback
cancelled
walletUsedAmount
otherExpense
roundOff
cashDiscount
totalItems
remark
paidStatus
vehicleNumber
destination
eWay
trans_mode
container_no
com_id
com_name
outstanding_balance
final_balance
advance_paid
invoice_starting
fin_starting
fin_ending
sale_type
place_supply
p_id
p_name
cash_disc_perc
sez
total_sale_amt
total_mrp_amt
profit
cust_saving
advance_used_status
advance_used_amount
sales_man
