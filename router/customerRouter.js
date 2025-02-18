const express = require("express")

const router = new express.Router()

// const importController = require("../controller/importCustomer")
const customerController = require("../controller/customerCont")
const customerSettings = require('../controller/customerSettings')
const dashboardController = require("../controller/dashboardController")



const checkPermission = require('../controller/permission');
const { verifyToken } = require('../controller/middleware');




//Basic
router.get('/customer-additional-data', verifyToken,customerController.getCustomerAdditionalData);




//Customer
router.post('/add-customer',verifyToken,checkPermission('Created New Customer'),customerController.addCustomer)

router.get('/get-all-customer',verifyToken,checkPermission('Viewed Customer details'),customerController.getAllCustomer)

router.get('/get-one-customer/:customerId',verifyToken,checkPermission('Viewed Customer details'),customerController.getOneCustomer)

router.put('/edit-customer/:customerId', verifyToken,checkPermission('Edited Customer information'),customerController.editCustomer);

router.put('/update-customer-status/:customerId', verifyToken,checkPermission('Edited Customer information'),customerController.updateCustomerStatus);

router.delete('/delete-customer/:customerId',verifyToken,checkPermission('Deleted Customer'),customerController.deleteCustomer);




router.get('/get-customer-transaction/:customerId',verifyToken,checkPermission('Viewed Customer details'),customerController.getCustomerTransactions);

router.get('/get-customer-dashboard/:date',verifyToken,checkPermission('Viewed Customer details'),dashboardController.getCustomerStats);

router.put('/update-customer-settings',verifyToken,checkPermission('Created a New Supplier'),customerSettings.updateCustomerSettings)


//Import
// router.post('/import-customer',verifyToken,checkPermission('Imported New Customers'), importController.importCustomer);


//Customer History
router.get('/get-one-customer-history/:customerId',verifyToken,checkPermission('Viewed Customer details'),customerController.getOneCustomerHistory)

module.exports = router











module.exports = router