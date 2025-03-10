const express = require("express")

const router = new express.Router()

const cpsController = require("../Sewnex/controller/cpsController");
const serviceController = require("../Sewnex/controller/serviceCont");
const membershipController = require("../Sewnex/controller/membershipPlanCont");
const itemController = require("../Sewnex/controller/itemController");

const checkPermission = require('../controller/middleware');
const { verifyToken } = require('../controller/middleware');

// CPS Routes
router.post('/add-cps/:type', verifyToken, cpsController.addCPS);
router.get('/get-all-cps/:type', verifyToken, cpsController.getAllCPS);
router.get('/get-one-cps/:type/:cpsId', verifyToken, cpsController.getOneCPS);
router.put('/edit-cps/:type/:cpsId', verifyToken, cpsController.editCPS);
router.delete('/delete-cps/:type/:cpsId', verifyToken, cpsController.deleteCPS);


// Service Routes
router.post('/add-service', verifyToken, serviceController.addService);
router.get('/get-all-service', verifyToken, serviceController.getAllServices);
router.get('/get-one-service/:serviceId', verifyToken, serviceController.getService);
router.put('/edit-service/:serviceId', verifyToken, serviceController.editService);
router.delete('/delete-service/:serviceId', verifyToken, serviceController.deleteService);


// Membership Plan Routes
router.post('/add-membership', verifyToken, membershipController.addMembershipPlan);
router.get('/get-all-membership', verifyToken, membershipController.getAllMembershipPlan);
router.get('/get-one-membership/:membershipId', verifyToken, membershipController.getOneMembershipPlan);
router.put('/edit-membership/:membershipId', verifyToken, membershipController.editMembershipPlan);
router.delete('/delete-membership/:membershipId', verifyToken, membershipController.deleteMembershipPlan);

//Order
router.post('/get-all-fabric-item', verifyToken, itemController.getAllItemFabric);



module.exports = router;