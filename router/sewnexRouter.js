const express = require("express")
const router = new express.Router()

const sxSettingCont = require("../Sewnex/controller/sxSettingCont")

const checkPermission = require('../controller/permission');
const { verifyToken } = require('../controller/middleware');
const { nexVerifyToken } = require('../controller/nexMiddleware');



// Sewnex order settings
router.put('/update-sewnex-order-settings',verifyToken,sxSettingCont.updateOrderSetting)

router.put('/update-sewnex-staff-settings',verifyToken,sxSettingCont.updateStaffSetting)

router.put('/update-sewnex-orderStatus-settings',verifyToken,sxSettingCont.updateOrderStatusSetting)

router.put('/update-sewnex-manufacturingStatus-settings',verifyToken,sxSettingCont.updateManufacturingStatusSetting)

router.get('/get-sewnex-order-settings',verifyToken,sxSettingCont.getOrderSetting)







module.exports = router;