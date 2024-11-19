const express = require("express")

const router = new express.Router()

const purchaseOrderController = require('../controller/purchaseOrderController');
const debitNoteController = require('../controller/debitNoteController'); 
const PaymentMadeController = require('../controller/paymentMadeController');
const purchaseSettingsController = require('../controller/purchaseSettingsController')
const billsController = require('../controller/billsController')
const SupplierController = require('../controller/supplierController')
 

const checkPermission = require('../controller/permission')
const { verifyToken } = require('../controller/middleware');
// router.post('/add-purchaseOrder',verifyToken,checkPermission('Created a New Supplier'), purchaseOrderController.addPurchaseOrder);

//Purchase Order
router.post('/add-purchaseOrder', verifyToken, checkPermission, purchaseOrderController.addPurchaseOrder);
router.get('/get-last-purchase-order-prefix', verifyToken, checkPermission, purchaseOrderController.getLastPurchaseOrderPrefix)

router.get('/get-all-purchaseOrders',verifyToken, checkPermission, purchaseOrderController.getAllPurchaseOrders);
router.get('/get-purchaseOrder/:id',verifyToken, checkPermission, purchaseOrderController.getPurchaseOrder);
// router.put('/update-purchaseOrder/:id', purchaseOrderController.updatePurchaseOrder);
// router.delete('/delete-purchaseOrder/:id', purchaseOrderController.deletePurchaseOrder);



//Bills
router.post('/add-Bills',verifyToken, checkPermission, billsController.addBills);
router.get('/get-all-Bills',verifyToken, checkPermission, billsController.getAllBills);
router.get('/get-a-Bill/:billId',verifyToken, checkPermission, billsController.getOneBill)
// router.put('/update-Bill/:id',billsController.updatePurchaseBill)
// router.delete('/delete-Bill/:id',billsController.deletePurchaseBill) 


 //paymentmade
router.post('/add-payment', verifyToken, checkPermission, PaymentMadeController.addPayment);
router.get('/getAllPayments', verifyToken, checkPermission, PaymentMadeController.getAllPayment );

router.get('/get-last-payment-made-prefix', verifyToken, checkPermission, PaymentMadeController.getLastPaymentMadePrefix )

router.get('/getPayment/:PaymentId', verifyToken, checkPermission, PaymentMadeController.getPurchasePayment);
// router.put('/updatePayment/:id', PaymentMadeController.updatePurchasePayment);
// router.delete('/deletePayment/:id', PaymentMadeController.deletePurchasePayment);

//Debit Note
router.post('/add-DebitNote', verifyToken, checkPermission, debitNoteController.addDebitNote);
router.get('/get-last-debit-note-prefix', verifyToken, checkPermission, debitNoteController.getLastDebitNotePrefix)
router.get('/get-all-debitNote', verifyToken, checkPermission, debitNoteController.getAllDebitNote);
router.get('/getDebitNote/:debitId', verifyToken, checkPermission, debitNoteController.getOneDebitNote);
// router.put('/updateDebitNote/:id', debitNoteController.updateDebitNote);
// router.delete('/deleteDebitNote/:id', debitNoteController.deleteDebitNote);

// purchase settings
router.put('/add-purchase-settings', verifyToken, checkPermission, purchaseSettingsController.updatePurchaseSettings)


// supplier transactions 
router.get('/get-supplier-purchaseOrders/:id', verifyToken, checkPermission, SupplierController.getPurchaseOrderSupplier);


module.exports = router