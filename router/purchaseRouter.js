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
router.post('/add-purchaseOrder', verifyToken, purchaseOrderController.addPurchaseOrder);
router.get('/get-last-purchase-order-prefix', verifyToken, purchaseOrderController.getLastPurchaseOrderPrefix)

router.get('/get-all-purchaseOrders',verifyToken, purchaseOrderController.getAllPurchaseOrder);
router.get('/get-purchaseOrder/:orderId',verifyToken, purchaseOrderController.getOnePurchaseOrder);
// router.put('/update-purchaseOrder/:id', purchaseOrderController.updatePurchaseOrder);
// router.delete('/delete-purchaseOrder/:id', purchaseOrderController.deletePurchaseOrder);



//Bills
router.post('/add-Bills',verifyToken, billsController.addBills);
router.get('/get-all-Bills',verifyToken, billsController.getAllBills);
router.get('/get-a-Bill/:billId',verifyToken, billsController.getOneBill);
router.get('/bill-journal/:billId',verifyToken,billsController.billJournal);
// router.put('/update-Bill/:id',billsController.updatePurchaseBill)
// router.delete('/delete-Bill/:id',billsController.deletePurchaseBill) 


 //paymentmade
router.post('/add-payment', verifyToken, PaymentMadeController.addPayment);
router.get('/getAllPayments', verifyToken, PaymentMadeController.getAllPayment );

router.get('/get-last-payment-made-prefix', verifyToken, PaymentMadeController.getLastPaymentMadePrefix )

router.get('/getPayment/:PaymentId', verifyToken, PaymentMadeController.getPurchasePayment);
// router.put('/updatePayment/:id', PaymentMadeController.updatePurchasePayment);
// router.delete('/deletePayment/:id', PaymentMadeController.deletePurchasePayment);

//Debit Note
router.post('/add-DebitNote', verifyToken, debitNoteController.addDebitNote);
router.get('/get-last-debit-note-prefix', verifyToken, debitNoteController.getLastDebitNotePrefix)
router.get('/get-all-debitNote', verifyToken, debitNoteController.getAllDebitNote);
router.get('/getDebitNote/:debitId', verifyToken, debitNoteController.getOneDebitNote);
// router.put('/updateDebitNote/:id', debitNoteController.updateDebitNote);
// router.delete('/deleteDebitNote/:id', debitNoteController.deleteDebitNote);

// purchase settings
router.put('/add-purchase-settings', verifyToken, purchaseSettingsController.updatePurchaseSettings)


// supplier transactions 
router.get('/get-supplier-purchaseOrders/:id', verifyToken, SupplierController.getPurchaseOrderSupplier);


module.exports = router