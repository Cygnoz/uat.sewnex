"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const trialBalanceSchema = new mongoose_1.Schema({
    organizationId: { type: String, required: true },
    operationId: { type: String, required: true },
    transactionId: { type: String, required: true },
    date: { type: String, required: true },
    accountId: { type: String, required: true },
    accountName: { type: String, required: true },
    action: { type: String, required: true },
    debitAmount: { type: Number },
    creditAmount: { type: Number },
    remark: { type: String }
});
const TrialBalance = (0, mongoose_1.model)('TrialBalance', trialBalanceSchema);
exports.default = TrialBalance;
