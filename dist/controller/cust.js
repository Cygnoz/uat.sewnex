"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCustomerTransactions = void 0;
const account_1 = __importDefault(require("../database/models/account"));
const customer_1 = __importDefault(require("../database/models/customer"));
const trialBalance_1 = __importDefault(require("../database/models/trialBalance")); // Ensure this is properly typed or create an interface for it
const getCustomerTransactions = async (req, res, next) => {
    try {
        const { customerId } = req.params;
        const { organizationId } = req.user;
        console.log(organizationId, customerId);
        // Step 1: Find the customer's account code in the Account collection
        const customer = await customer_1.default.findOne({ _id: customerId, organizationId });
        if (!customer) {
            res.status(404).json({ message: "Customer not found" });
            return; // Use `return` to prevent further execution after sending the response
        }
        const account = await account_1.default.findOne({ accountCode: customerId, organizationId });
        if (!account) {
            res.status(404).json({ message: "Account not found for this customer" });
            return;
        }
        // Step 2: Use account _id to find matching transactions in the TrialBalance collection
        const customerTransactions = await trialBalance_1.default.find({ accountId: account._id, organizationId });
        // Step 3: Send the customer transactions as a response
        res.status(200).json({ customerTransactions });
    }
    catch (error) {
        next(error); // Proper error handling with `next`
    }
};
exports.getCustomerTransactions = getCustomerTransactions;
