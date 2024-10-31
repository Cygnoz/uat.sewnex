const express = require("express")

const router = new express.Router()

const salesSettings = require('../controller/salesSettings')
const salesQuotes = require('../controller/salesQuotes')
const salesOrder = require('../controller/salesOrder')
const salesInvoice = require('../controller/salesInvoice')
const customerController = require('../controller/customerController')

const checkPermission = require('../controller/permission');
const { verifyToken } = require('../controller/middleware');



//Sales settings
router.put('/add-sales-settings',salesSettings.addSalesOrderSettings)

router.put('/add-creditNote-settings',salesSettings.updateCreditNoteSettings)



//Sales Quotes
router.post('/add-sales-quotes',verifyToken,salesQuotes.addQuotes)

router.get('/get-last-sales-quotes-prefix',verifyToken,salesQuotes.getLastQuotesPrefix)

router.get('/get-all-sales-quotes',verifyToken,salesQuotes.getAllSalesQuote)

router.get('/get-one-sales-quotes/:quoteId',verifyToken,salesQuotes.getOneSalesQuote)



//Sales Order
router.post('/add-sales-order',verifyToken,salesOrder.addOrder)

router.get('/get-last-sales-order-prefix',verifyToken,salesOrder.getLastOrderPrefix)



// Delivery Chellans
router.put('/add-deliveryChellans', salesSettings.addDeliveryChellans);



//Shipment
router.put('/add-shipment-address-settings',salesSettings.addShipmentAddressSettings)



//invoice
router.post('/add-sales-invoice',verifyToken,salesInvoice.addInvoice)

router.put('/add-salesInvoice-settings',salesSettings.addInvoiceSettings)


// customer sales Hisory
router.get('/get-customer-sales-history/:id',verifyToken,customerController.customerSaleHistory)



module.exports = router