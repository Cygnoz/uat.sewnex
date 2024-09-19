const express = require("express")

const router = new express.Router()

const salesSettings = require('../controller/salesSettings')
const salesOrderController = require('../controller/salesOrderController')


//salesOrder
router.post('/add-salesOrder', salesOrderController.addSalesOrder)

//Sales settings
router.put('/add-sales-settings',salesSettings.addSalesOrderSettings)

router.put('/add-creditNote-settings',salesSettings.updateCreditNoteSettings)

// Delivery Chellans
router.put('/add-deliveryChellans', salesSettings.addDeliveryChellans);

//shipment
router.put('/add-shipment-address-settings',salesSettings.addShipmentAddressSettings)

//invoice
router.put('/add-salesInvoice-settings',salesSettings.addInvoiceSettings)



module.exports = router