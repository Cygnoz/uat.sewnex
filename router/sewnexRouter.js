const express = require("express")

const router = new express.Router()

const sxOrderCont = require('../Sewnex/controller/sxOrderCont');
const internalOrder = require('../Sewnex/controller/internalOrderCont');


const checkPermission = require('../controller/permission');
const { verifyToken } = require('../controller/middleware');




//Sewnex Order
router.post('/add-sewnex-order',verifyToken,sxOrderCont.addOrder);


//Internal order
router.post('/add-internal-order',verifyToken,internalOrder.addIntOrder)


module.exports = router