const express = require("express")

const router = new express.Router()

const itemController = require("../controller/itemController");
const unitController = require("../controller/unitController")
const bmcrController = require('../controller/bmcrController');
const itemDropdownController = require("../controller/itemDropdownController")
const itemSettingsController = require("../controller/itemSettingsController")
const dashboardController = require("../controller/dashboardController")


const checkPermission = require('../controller/permission');
const { verifyToken } = require('../controller/middleware');

//item dropdowm
router.get('/get-itemDropdown',verifyToken, itemDropdownController.getItemDropdowm);

router.get('/get-inventory-Dashboard/:date',verifyToken, dashboardController.calculateTotalInventoryValue);

router.get('/get-item-transaction/:id',verifyToken, itemController.itemTransaction);


// Item
router.post('/add-item',verifyToken,checkPermission('Created a New Item'), itemController.addItem);
router.get('/get-all-item',verifyToken,checkPermission('Viewed Item Information'), itemController.getAllItem);
router.get('/get-all-item-xs',verifyToken,checkPermission('Viewed Item Information'), itemController.newgetAllItem);

router.get('/get-one-item/:itemId',verifyToken,checkPermission('Viewed Item Information'), itemController.getAItem)
router.put('/edit-item/:itemId',verifyToken,checkPermission('Edited Item Information'), itemController.updateItem)
router.delete('/delete-item/:itemId',verifyToken,checkPermission('Deleted an Item'), itemController.deleteItem)


// Unit
router.post('/add-unit',verifyToken,checkPermission('Created a New Unit'), unitController.addUnit);
router.get('/get-all-unit',verifyToken,checkPermission('Viewed Unit Information'), unitController.getAllUnit);
router.get('/get-one-unit/:_id',verifyToken,checkPermission('Viewed Unit Information'), unitController.getOneUnit);
router.put('/edit-unit/:_id',verifyToken,checkPermission('Edited Unit Information'), unitController.updateUnit);
router.delete('/delete-unit/:id',verifyToken,checkPermission('Deleted a Unit'), unitController.deleteUnit);

// Unit Conversion
// router.post('/add-unitConversion', unitController.addUnitConversion);
// router.put('/get-all-unitConversion', unitController.getAllUnitConversion);
// router.get('/get-one-unitConversion/:_id', unitController.getOneUnitConversion);
// router.put('/edit-unitConversion', unitController.updateUnitConversion);
// router.delete('/delete-unitConversion/:id', unitController.deleteUnitConversion);



//BMCR - Brand Manufacturer Category Rack
router.post('/add-bmcr',verifyToken,checkPermission('Created a New BMCR'), bmcrController.addBmcr);
router.put('/get-all-bmcr',verifyToken,checkPermission('Viewed BMCR Information'), bmcrController.getAllBmcr);
router.get('/get-a-bmcr/:id',verifyToken,checkPermission('Viewed BMCR Information'), bmcrController.getABmcr);
router.put('/update-bmcr',verifyToken,checkPermission('Edited BMCR Information'), bmcrController.updateBmcr);
router.delete('/delete-bmcr/:id',verifyToken,checkPermission('Deleted a BMCR'), bmcrController.deleteBmcr)



 
//items settings
router.put('/add-item-settings',verifyToken,checkPermission('Setup/Modified Item Setting'), itemSettingsController.addItemSettings);
// router.post('/get-item-settings',itemSettings.getItemSettings);





//Item Track
router.get('/get-all-item-track',verifyToken,checkPermission('Viewed Item Information'), itemSettingsController.getAllItemTrack);
router.get('/get-one-item-track/:itemId',verifyToken,checkPermission('Viewed Item Information'), itemSettingsController.getAItemTrack)










// // Item
// router.post('/add-item', itemController.addItem);
// router.put('/get-all-item', itemController.getAllItem);
// router.get('/get-one-item/:id', itemController.getAItem)
// router.put('/edit-item',itemController.updateItem)
// router.delete('/delete-item/:id',itemController.deleteItem)


// // Unit
// router.post('/add-unit', unitController.addUnit);
// router.put('/get-all-unit', unitController.getAllUnit);
// router.get('/get-one-unit/:_id', unitController.getOneUnit);
// router.put('/edit-unit', unitController.updateUnit);
// router.delete('/delete-unit/:id', unitController.deleteUnit);

// // Unit Conversion
// // router.post('/add-unitConversion', unitController.addUnitConversion);
// // router.put('/get-all-unitConversion', unitController.getAllUnitConversion);
// // router.get('/get-one-unitConversion/:_id', unitController.getOneUnitConversion);
// // router.put('/edit-unitConversion', unitController.updateUnitConversion);
// // router.delete('/delete-unitConversion/:id', unitController.deleteUnitConversion);



// //BMCR - Brand Manufacturer Category Rack
// router.post('/add-bmcr', bmcrController.addBmcr);
// router.put('/get-all-bmcr', bmcrController.getAllBmcr);
// router.put('/get-a-bmcr/:id', bmcrController.getABmcr);
// router.put('/update-bmcr', bmcrController.updateBmcr);
// router.delete('/delete-bmcr/:id',bmcrController.deleteBmcr)

// //item dropdowm
// router.put('/get-itemDropdown', itemDropdownController.getItemDropdowm);

 
// //items settings
// router.put('/add-item-settings',itemSettingsController.addItemSettings);
// // router.post('/get-item-settings',itemSettings.getItemSettings);


module.exports = router