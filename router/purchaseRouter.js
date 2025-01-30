const express = require("express")

const router = new express.Router()

const purchaseOrderController = require('../controller/Purchase Order/purchaseOrderController');
const updateOrderController = require('../controller/Purchase Order/updateOrder');

const debitNoteController = require('../controller/Debit Note/debitNoteController'); 
const updateDebitNote = require('../controller/Debit Note/updateDebitNote'); 

const PaymentMadeController = require('../controller/Payment Made/paymentMadeController');
const updatePaymentMade = require('../controller/Payment Made/updatePaymentMade');

const purchaseSettingsController = require('../controller/purchaseSettingsController')

const billsController = require('../controller/Bills/billsController')
const updateBills = require('../controller/Bills/updateBills')

const SupplierController = require('../controller/supplierController')
 

const checkPermission = require('../controller/permission')
const { verifyToken } = require('../controller/middleware');
// router.post('/add-purchaseOrder',verifyToken,checkPermission('Created a New Supplier'), purchaseOrderController.addPurchaseOrder);

//Purchase Order
router.post('/add-purchaseOrder', verifyToken, purchaseOrderController.addPurchaseOrder);
router.get('/get-last-purchase-order-prefix', verifyToken, purchaseOrderController.getLastPurchaseOrderPrefix)

router.get('/get-all-purchaseOrders',verifyToken, purchaseOrderController.getAllPurchaseOrder);
router.get('/get-purchaseOrder/:orderId',verifyToken, purchaseOrderController.getOnePurchaseOrder);
router.put('/update-purchaseOrder/:orderId', verifyToken, updateOrderController.updatePurchaseOrder);
router.delete('/delete-purchaseOrder/:orderId', verifyToken, updateOrderController.deletePurchaseOrder);



//Bills
router.post('/add-Bills',verifyToken, billsController.addBills);
router.get('/get-all-Bills',verifyToken, billsController.getAllBills);
router.get('/get-a-Bill/:billId',verifyToken, billsController.getOneBill);
router.get('/bill-journal/:billId',verifyToken,billsController.billJournal);
router.get('/get-last-bills-prefix', verifyToken, billsController.getLastBillsPrefix);
router.put('/update-bill/:billId', verifyToken, updateBills.updateBill);
router.delete('/delete-bill/:billId', verifyToken, updateBills.deletePurchaseBill); 


 //paymentMade
router.post('/add-payment', verifyToken, PaymentMadeController.addPayment);
router.get('/getAllPayments', verifyToken, PaymentMadeController.getAllPayment );
router.get('/payment-journal/:paymentId', verifyToken, PaymentMadeController.paymentJournal);
router.get('/get-last-payment-made-prefix', verifyToken, PaymentMadeController.getLastPaymentMadePrefix )
router.get('/getPayment/:paymentId', verifyToken, PaymentMadeController.getPurchasePayment);
router.put('/update-paymentMade/:paymentId', verifyToken, updatePaymentMade.updatePaymentMade);
router.delete('/delete-paymentMade/:paymentId', verifyToken, updatePaymentMade.deletePaymentMade);


//Debit Note
router.post('/add-DebitNote', verifyToken, debitNoteController.addDebitNote);
router.get('/get-last-debit-note-prefix', verifyToken, debitNoteController.getLastDebitNotePrefix)
router.get('/get-all-debitNote', verifyToken, debitNoteController.getAllDebitNote);
router.get('/getDebitNote/:debitId', verifyToken, debitNoteController.getOneDebitNote);
router.get('/debitNote-journal/:debitId', verifyToken, debitNoteController.debitNoteJournal);
router.put('/update-debitNote/:debitId', verifyToken, updateDebitNote.updateDebitNote);
router.delete('/delete-debitNote/:debitId', verifyToken, updateDebitNote.deleteDebitNote);


// purchase settings
router.put('/add-purchase-settings', verifyToken, purchaseSettingsController.updatePurchaseSettings)


// supplier transactions 
router.get('/get-supplier-purchaseOrders/:id', verifyToken, SupplierController.getPurchaseOrderSupplier);


module.exports = router