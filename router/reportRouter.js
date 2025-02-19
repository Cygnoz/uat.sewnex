const express = require("express")
const dayBook = require("../controller/dayBook");
const trialBalance = require("../controller/trialBalance");
const reports = require("../controller/reports");

const checkPermission = require('../controller/permission');
const { verifyToken } = require('../controller/middleware');

const router = new express.Router()

router.get("/dayBook/:startDate/:endDate", verifyToken, checkPermission("Viewed Reports"), dayBook.getDayBook);
router.get("/trialBalance/:startDate/:endDate", verifyToken, checkPermission("Viewed Reports"), trialBalance.getTrialBalance);
router.get("/tradingAccount/:startDate/:endDate", verifyToken, checkPermission("Viewed Reports"), reports.calculateTradingAccount);
router.get("/profitAndLoss/:startDate/:endDate", verifyToken, checkPermission("Viewed Reports"), reports.calculateProfitAndLoss);
router.get("/balanceSheet/:startDate/:endDate", verifyToken, checkPermission("Viewed Reports"), reports.calculateBalanceSheet);

module.exports = router