const express = require("express")
const dayBook = require("../controller/dayBook");
const trialBalance = require("../controller/trialBalance");
const { verifyToken } = require('../controller/middleware');
const reports = require("../controller/reports");

const router = new express.Router()

router.get("/dayBook/:startDate/:endDate", verifyToken, dayBook.getDayBook);
router.get("/trialBalance/:startDate/:endDate", verifyToken, trialBalance.getTrialBalance);
router.get("/tradingAccount/:startDate/:endDate", verifyToken, reports.calculateTradingAccount);
router.get("/profitAndLoss/:startDate/:endDate", verifyToken, reports.calculateProfitAndLoss);
router.get("/balanceSheet/:startDate/:endDate", verifyToken, reports.calculateBalanceSheet);

module.exports = router