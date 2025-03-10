const express = require("express")

const router = new express.Router()

const sxOrderCont = require('../Sewnex/controller/sxOrderCont')


const checkPermission = require('../controller/permission');
const { verifyToken } = require('../controller/middleware');




//Sewnex Order
router.post('/add-sewnex-order',verifyToken,sxOrderCont.addOrder)



module.exports = router