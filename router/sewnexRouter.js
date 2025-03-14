const express = require("express")

const router = new express.Router()

const sxOrderCont = require('../Sewnex/controller/sxOrderCont');
const internalOrder = require('../Sewnex/controller/internalOrderCont');
const updateInternalOrder = require('../Sewnex/controller/updateInternalOrderCont');

const checkPermission = require('../controller/permission');
const { verifyToken } = require('../controller/middleware');




//Sewnex Order
router.post('/add-sewnex-order',verifyToken,sxOrderCont.addOrder);

router.get('/get-all-sewnex-order',verifyToken,sxOrderCont.getAllOrders);

router.get('/get-one-sewnex-order/:orderId',verifyToken,sxOrderCont.getOneOrder);

router.get('/sewnex-order-prefix',verifyToken,sxOrderCont.getLastOrderPrefix)

router.get('/sewnex-order-journal/:orderId',verifyToken,sxOrderCont.orderJournal)




//Internal order
router.post('/add-internal-order',verifyToken,internalOrder.addIntOrder)

router.put('/edit-internal-order',verifyToken,updateInternalOrder.editInternalOrder)

router.delete('/delete-internal-order',verifyToken,updateInternalOrder.deleteInternalOrder)




module.exports = router