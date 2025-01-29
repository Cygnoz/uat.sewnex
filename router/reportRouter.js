const express = require("express")
const dayBook = require("../controller/dayBook");
const trialBalance = require("../controller/trialBalance");
const { verifyToken } = require('../controller/middleware');
const financialStatement = require("../controller/financialStatementController");

const router = new express.Router()

router.get("/dayBook/:startDate/:endDate", verifyToken, dayBook.getDayBook);
router.get("/trialBalance/:startDate/:endDate", verifyToken, trialBalance.getTrialBalance);
router.get("/tradingAccount/:startDate/:endDate", verifyToken, financialStatement.calculateTradingAccount);
router.get("/profitAndLoss/:startDate/:endDate", verifyToken, financialStatement.calculateProfitAndLoss);
router.get("/balanceSheet/:startDate/:endDate", verifyToken, financialStatement.calculateBalanceSheet);

module.exports = router