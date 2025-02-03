const express = require("express")
const router = new express.Router()

const supplierCont = require('../controller/suppliercont');
const supplierSettings = require('../controller/suplierSettings')
const importController = require('../controller/importSupplier')
const dashboardController = require("../controller/dashboardController")

const checkPermission = require('../controller/permission')
const { verifyToken } = require('../controller/middleware');

// supplier
router.get('/get-Supplier-Trandactions/:supplierId',verifyToken,supplierCont.getSupplierTransactions);

router.get('/get-Supplier-Dashboard/:date',verifyToken,dashboardController.getSupplierStats);

router.post('/add-suppliers',verifyToken,checkPermission('Created a New Supplier'), supplierCont.addSupplier);

router.get('/get-all-supplier',verifyToken,checkPermission('Viewed Supplier Details'), supplierCont.getAllSuppliers);

router.get('/get-supplier/:supplierId',verifyToken,checkPermission('Viewed Supplier Details'), supplierCont.getOneSupplier);

router.put('/update-supplier/:supplierId',verifyToken,checkPermission('Edited Supplier Information'), supplierCont.updateSupplier);

router.delete('/delete-supplier/:supplierId',verifyToken, supplierCont.deleteSupplier);


router.put('/update-supplier-status/:supplierId' ,verifyToken,checkPermission('Modified Supplier Status'),supplierCont.updateSupplierStatus)

router.get('/supplier-additional-data',verifyToken, supplierCont.getSupplierAdditionalData);

router.post('/import-supplier',verifyToken,checkPermission('Import New Suppliers'),importController.importSupplier);

router.get('/get-one-supplier-history/:supplierId',verifyToken,checkPermission('Viewed Supplier Details'),supplierCont.getOneSupplierHistory)

router.put('/update-supplier-customer-settings',verifyToken,checkPermission('Created a New Supplier'),supplierSettings.updateSupplierCustomerSettings)

module.exports = router