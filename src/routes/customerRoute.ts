import express, { Request, Response, NextFunction } from 'express';
import { getCustomerTransactions } from '../controllers/customer'; 

const router = express.Router();

interface CustomRequest extends Request {
    user: {
        organizationId: string;
    };
}

// Basic
router.get('/get-Customer-Trandactions', (req: Request, res: Response, next: NextFunction) => {
    getCustomerTransactions(req as CustomRequest, res, next); // Cast `req` to `CustomRequest` if needed
});

export default router;
