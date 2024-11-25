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
router.put('/add-sales-settings',verifyToken,salesSettings.addSalesOrderSettings)

router.put('/add-creditNote-settings',verifyToken,salesSettings.updateCreditNoteSettings)



//Sales Quotes
router.post('/add-sales-quotes',verifyToken,salesQuotes.addQuotes)

router.get('/get-last-sales-quotes-prefix',verifyToken,salesQuotes.getLastQuotesPrefix)

router.get('/get-all-sales-quotes',verifyToken,salesQuotes.getAllSalesQuote)

router.get('/get-one-sales-quotes/:quoteId',verifyToken,salesQuotes.getOneSalesQuote)



//Sales Order
router.post('/add-sales-order',verifyToken,salesOrder.addOrder)

router.get('/get-last-sales-order-prefix',verifyToken,salesOrder.getLastOrderPrefix)

router.get('/get-all-sales-order',verifyToken,salesOrder.getAllSalesOrder)

router.get('/get-one-sales-order/:orderId',verifyToken,salesOrder.getOneSalesOrder)



// Delivery Chellans
router.put('/add-deliveryChellans',verifyToken, salesSettings.addDeliveryChellans);



//Shipment
router.put('/add-shipment-address-settings',verifyToken,salesSettings.addShipmentAddressSettings)



//Sales Invoice
router.post('/sales-invoice',verifyToken,salesInvoice.addInvoice)

router.put('/sales-invoice-settings',verifyToken,salesSettings.addInvoiceSettings)

router.get('/sales-invoice-prefix',verifyToken,salesInvoice.getLastInvoicePrefix)

router.get('/invoice-journal/:invoiceId',verifyToken,salesInvoice.invoiceJournal)

router.get('/sales-invoice',verifyToken,salesInvoice.getAllSalesInvoice)

router.get('/sales-order/:invoiceId',verifyToken,salesInvoice.getOneSalesInvoice)





// customer sales Hisory
router.get('/get-customer-sales-history/:id',verifyToken,customerController.customerSaleHistory)



//Sales receipt
router.post('/sales-receipt',verifyToken,salesReceipt.addReceipt)

router.get('/get-all-receipt',verifyToken,salesReceipt.getAllSalesReceipt)

router.get('/get-receipt/:PaymentId',verifyToken,salesReceipt.getSalesReceipt)

module.exports = router