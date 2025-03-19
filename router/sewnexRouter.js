const express = require("express")

const router = new express.Router()

const sxOrderCont = require('../Sewnex/controller/sxOrderCont');
const internalOrder = require('../Sewnex/controller/internalOrderCont');
const updateInternalOrder = require('../Sewnex/controller/updateInternalOrderCont');
const updateSxOrderCont = require('../Sewnex/controller/updateSxOrderCont');
const sxOrderStatusCont = require('../Sewnex/controller/orderStatusCont');

const checkPermission = require('../controller/permission');
const { verifyToken } = require('../controller/middleware');




//Sewnex Order
router.post('/add-sewnex-order',verifyToken,sxOrderCont.addOrder);

router.get('/get-all-sewnex-order',verifyToken,sxOrderCont.getAllOrders);

router.get('/get-one-sewnex-order/:orderId',verifyToken,sxOrderCont.getOneOrder);

router.get('/sewnex-order-prefix',verifyToken,sxOrderCont.getLastOrderPrefix);

router.get('/sewnex-order-journal/:orderId',verifyToken,sxOrderCont.orderJournal);

router.put('/edit-sewnex-order/:orderId',verifyToken,updateSxOrderCont.editOrder);

router.put('/manufacturing-process/:orderServiceId',verifyToken,sxOrderCont.manufacturingProcessing);

router.delete('/delete-sewnex-order/:orderId',verifyToken,updateSxOrderCont.deleteOrder);



//Sewnex Order Status Change
router.post('/add-order-status-change',verifyToken,sxOrderStatusCont.addOrderStatus);

router.get('/get-order-status-change',verifyToken,sxOrderStatusCont.getOrderStatus);




//Internal order
router.post('/add-internal-order',verifyToken,internalOrder.addIntOrder);

router.get('/get-all-internal-order',verifyToken,internalOrder.getAllOrders);

router.get('/sewnex-internal-order-prefix',verifyToken,internalOrder.getLastInternalOrderPrefix);

router.get('/get-one-internal-order/:orderId',verifyToken,internalOrder.getOneOrder);

router.put('/edit-internal-order/:orderId',verifyToken,updateInternalOrder.editInternalOrder);

router.delete('/delete-internal-order/:orderId',verifyToken,updateInternalOrder.deleteInternalOrder);






module.exports = router