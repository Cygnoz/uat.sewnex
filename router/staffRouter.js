const express = require("express")

const router = new express.Router()
const staffController = require("../controller/staffController")


//Register
router.post('/add-staff',staffController.addStaff)


module.exports = router