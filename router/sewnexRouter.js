const express = require("express")
const router = new express.Router()

const sxSettingCont = require("../Sewnex/controller/sxSettingCont")

const checkPermission = require('../controller/permission');
const { verifyToken } = require('../controller/middleware');
const { nexVerifyToken } = require('../controller/nexMiddleware');



// Sewnex order settings
router.post('/add-sewnex-order-settings',verifyToken,sxSettingCont.addSewnexOrderSetting)

router.get('/get-sewnex-order-settings',verifyToken,sxSettingCont.getSewnexOrderSetting)







module.exports = router;