import { Request, Response, NextFunction } from "express";
import Account from "../models/account";
// import Account, { AccountDocument } from "../models/account";
import Customer from "../models/customer";
// import TrialBalance from "../models/trialBalance"; // Ensure this is properly typed or create an interface for it
// import moment from "moment-timezone";

// Define types for the request user object if it is custom
interface CustomRequest extends Request {
    user: {
        organizationId: string;
    };
}

export const getCustomerTransactions = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // const { customerId } = req.params as { customerId: string };
        // const { organizationId } = req.user;

        // console.log(organizationId, customerId);

        // Step 1: Find the customer's account code in the Account collection
        const customer = await Customer.findOne();
        if (!customer) {
            res.status(404).json({ message: "Customer not found" });
            return; // Use `return` to prevent further execution after sending the response
        }

        const account = await Account.findOne();
        if (!account) {
            res.status(404).json({ message: "Account not found for this customer" });
            return;
        }

        

        // Step 3: Send the customer transactions as a response
        res.status(200).json({customer,account});
    } catch (error) {
        next(error); 
    }
};
