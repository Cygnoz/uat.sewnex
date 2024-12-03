"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const accountSchema = new mongoose_1.Schema({
    organizationId: { type: String, required: true },
    accountName: { type: String, required: true },
    accountCode: { type: String, required: true },
    accountId: { type: String, required: true },
    accountSubhead: { type: String, required: true },
    accountHead: { type: String, required: true },
    accountGroup: { type: String, required: true },
    openingDate: { type: String },
    description: { type: String },
    bankAccNum: { type: String },
    bankIfsc: { type: String },
    bankCurrency: { type: String },
});
const Account = (0, mongoose_1.model)('Accounts', accountSchema);
exports.default = Account;
