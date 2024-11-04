const express = require("express")

const router = new express.Router()

const purchaseOrderController = require('../controller/purchaseOrderController');
const debitNoteController = require('../controller/debitNoteController'); 
const PaymentMadeController = require('../controller/paymentMadeController');
const purchaseSettingsController = require('../controller/purchaseSettingsController')
const billsCont = require('../controller/billsCont')
const SupplierController = require('../controller/supplierController')
 

const checkPermission = require('../controller/permission')
const { verifyToken } = require('../controller/middleware');
// router.post('/add-purchaseOrder',verifyToken,checkPermission('Created a New Supplier'), purchaseOrderController.addPurchaseOrder);

//Purchase Order

router.post('/add-purchaseOrder', verifyToken, purchaseOrderController.addPurchaseOrder);
router.get('/get-last-purchase-order-prefix', verifyToken,purchaseOrderController.getLastPurchaseOrderPrefix)

router.get('/get-all-purchaseOrders',verifyToken, purchaseOrderController.getAllPurchaseOrders);
router.get('/get-purchaseOrder/:id',verifyToken, purchaseOrderController.getPurchaseOrder);
// router.put('/update-purchaseOrder/:id', purchaseOrderController.updatePurchaseOrder);
// router.delete('/delete-purchaseOrder/:id', purchaseOrderController.deletePurchaseOrder);



//Bills
router.post('/add-Bills',verifyToken,billsCont.addBill);
router.get('/get-all-Bills',verifyToken,billsCont.getAllPurchaseBills);
router.get('/get-a-Bill/:id',verifyToken,billsCont.getPurchaseBill)
// router.put('/update-Bill/:id',billsController.updatePurchaseBill)
// router.delete('/delete-Bill/:id',billsController.deletePurchaseBill)


 //paymentmade
router.post('/add-payment', verifyToken , PaymentMadeController.addPayment);
router.get('/getAllPayments', verifyToken , PaymentMadeController.getAllPayment );
router.get('/get-last-payment-made-prefix',verifyToken,PaymentMadeController.getLastPaymentMadePrefix )
// router.get('/getPayment/:id', PaymentMadeController.getPurchasePayment);
// router.put('/updatePayment/:id', PaymentMadeController.updatePurchasePayment);
// router.delete('/deletePayment/:id', PaymentMadeController.deletePurchasePayment);

//Debit Note
router.post('/add-DebitNote', verifyToken, debitNoteController.addDebitNote);
// router.get('/getAllDebitNotes/:id', debitNoteController.getAllDebitNotes);
// router.get('/getDebitNote/:id', debitNoteController.getDebitNoteById);
// router.put('/updateDebitNote/:id', debitNoteController.updateDebitNote);
// router.delete('/deleteDebitNote/:id', debitNoteController.deleteDebitNote);

// purchase settings
router.put('/add-purchase-settings', verifyToken,purchaseSettingsController.updatePurchaseSettings)


// supplier transactions 
router.get('/get-supplier-purchaseOrders/:id',verifyToken, SupplierController.getPurchaseOrderSupplier);


module.exports = router