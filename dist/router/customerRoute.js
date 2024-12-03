"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cust_1 = require("../controller/cust"); // Ensure proper export in `cust.ts`
const router = express_1.default.Router();
// Basic
router.get('/get-Customer-Trandactions/:customerId', (req, res, next) => {
    (0, cust_1.getCustomerTransactions)(req, res, next); // Cast `req` to `CustomRequest` if needed
});
exports.default = router;
