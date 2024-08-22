const express = require("express")

const router = new express.Router()


const purchaseOrderController = require('../controller/purchaseOrderController');
const debitNoteController = require('../controller/debitNoteController'); 
const PaymentMadeController = require('../controller/paymentMadeController');
const purchaseSettingsController = require('../controller/purchaseSettingsController')
//paymentmade

router.post('/addPayment', PaymentMadeController.addPurchasePayment);
router.get('/getAllPayments/:id', PaymentMadeController.getAllPurchasePayments );
router.get('/getPayment/:id', PaymentMadeController.getPurchasePayment);
router.put('/updatePayment/:id', PaymentMadeController.updatePurchasePayment);
router.delete('/deletePayment/:id', PaymentMadeController.deletePurchasePayment);

//Purchase Order
router.post('/addPurchaseOrder', purchaseOrderController.addPurchaseOrder);
router.get('/getAllPurchaseOrders', purchaseOrderController.getAllPurchaseOrders);
router.get('/getPurchaseOrder/:id', purchaseOrderController.getPurchaseOrder);
router.put('/updatePurchaseOrder/:id', purchaseOrderController.updatePurchaseOrder);
router.delete('/deletePurchaseOrder/:id', purchaseOrderController.deletePurchaseOrder);

//Debit Note
router.post('/addDebitNote', debitNoteController.addDebitNote);
router.get('/getAllDebitNotes/:id', debitNoteController.getAllDebitNotes);
router.get('/getDebitNote/:id', debitNoteController.getDebitNoteById);
router.put('/updateDebitNote/:id', debitNoteController.updateDebitNote);
router.delete('/deleteDebitNote/:id', debitNoteController.deleteDebitNote);

// purchase settings
router.put('/add-purchase-settings',purchaseSettingsController.updatePurchaseSettings)

module.exports = router