const express = require("express")
const router = new express.Router()

const organizationController = require("../controller/organizationController")
const clientController = require("../controller/clientController")
const userController = require("../controller/userController")

const currencyController = require("../controller/settings/currencyController")
const paymentTermCont = require("../controller/settings/paymentTermCont")
const prefixController = require("../controller/settings/prefixController")
const settingController = require("../controller/settings/settingController")
const taxController = require("../controller/settings/taxController")
const deafalutController = require("../controller/settings/defaultAccCont")



const checkPermission = require('../controller/permission');
const { verifyToken } = require('../controller/middleware');








//Production

//Basic
router.get('/get-countries-data',verifyToken,organizationController.getCountriesData)

router.get('/get-additional-data',verifyToken,organizationController.getAdditionalData)



//Organization
router.post('/setup-organization',verifyToken,checkPermission('Setup/Modified Organization Details'),organizationController.setupOrganization)

router.get('/get-one-organization',verifyToken,checkPermission('Viewed Organization Details'),organizationController.getOneOrganization)







// Setting

router.get('/get-settings',verifyToken,checkPermission('Viewed Setting details'),settingController.getSettings)





// Currency

router.get('/get-currency',verifyToken,checkPermission('Viewed Currency Details'),currencyController.getCurrency)

router.get('/view-currency/:id',verifyToken,checkPermission('Viewed Currency Details'),currencyController.viewCurrency)

router.post('/add-currency',verifyToken,checkPermission('Added a new Currency'),currencyController.addCurrency)

router.put('/edit-currency',verifyToken,checkPermission('Edited Currency Information'),currencyController.editCurrency)

router.delete('/delete-currency/:currencyId',verifyToken,checkPermission('Deleted a Currency'),currencyController.deleteCurrency)





// Invoice 

router.put('/add-invoice-settings',verifyToken,checkPermission('Setup/Modified Invoice Setting'),settingController.updateInvoiceSettings)





// Payment Terms

router.post('/add-payment-terms',verifyToken,checkPermission('Added Payment Term'),paymentTermCont.addPaymentTerm)

router.put('/edit-payment-terms/:id',verifyToken,checkPermission('Edited Payment Term'),paymentTermCont.editPaymentTerm)

router.delete('/delete-payment-terms',verifyToken,checkPermission('Deleted Payment Term'),paymentTermCont.deletePaymentTerm)

router.get('/get-all-payment-terms',verifyToken,checkPermission('Viewed Payment Term'),paymentTermCont.getAllPaymentTerms)





//Tax

router.post('/add-tax',verifyToken,checkPermission('Added Tax Information'),taxController.addTax)

router.put('/edit-tax',verifyToken,checkPermission('Edited Tax Information'),taxController.editTaxRate)

router.get('/get-tax',verifyToken,checkPermission('Viewed Tax Information'),taxController.getTax)





//Prefix

router.post('/add-prefix',verifyToken,checkPermission('Added Prefix'),prefixController.addPrefix)

router.get('/get-prefix',verifyToken,checkPermission('Viewed Prefix'),prefixController.getPrefix)

router.put('/edit-prefix',verifyToken,checkPermission('Edited Prefix'),prefixController.updatePrefix)

router.delete('/prefix/:seriesId',verifyToken,checkPermission('Deleted Prefix'),prefixController.deletePrefix)

router.put('/status-prefix',verifyToken,checkPermission('Modified Prefix Status'),prefixController.setPrefixSeriesStatusTrue)





//Default Account

router.post('/add-default-account',verifyToken,deafalutController.addDefaultAccount)

router.get('/get-default-account',verifyToken,deafalutController.getDefaultAccount)






//Internal

router.get('/get-all-organization',organizationController.getAllOrganization)

router.post('/create-client',clientController.createOrganizationAndClient)

router.get('/get-all-client',clientController.getAllClient)

router.delete('/delete-organization/:organizationId',organizationController.deleteOrganization)

router.get('/delete-all',clientController.deleteAll)





//Login
router.post('/login',userController.login)

router.post('/verify-otp',userController.verifyOtp)





module.exports = router
















