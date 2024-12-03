import { Schema, Document, model } from 'mongoose';

export interface TrialBalanceDocument extends Document {
    _id: string;
    organizationId: string;
    operationId: string;
    transactionId: string; //prefix
    accountId: string;
    accountName: string;
    action: string;
    debitAmount?: number;
    creditAmount?: number;
    remark?: string;
    
    createdDate: Date; 
    createdTime: string; 
}

const trialBalanceSchema = new Schema<TrialBalanceDocument>({
    organizationId: { type: String, required: true },
    operationId: { type: String, required: true },
    transactionId: { type: String, required: true },

    accountId: { type: String, required: true },
    accountName: { type: String, required: true },
    
    action: { type: String, required: true },
    
    debitAmount: { type: Number },
    creditAmount: { type: Number },
    remark: { type: String },
    
    createdDate: { type: Date, default: () => new Date().setHours(0, 0, 0, 0) }, 
    createdTime: { type: String, default: () => new Date().toTimeString().split(' ')[0] }, 
});

const TrialBalance = model<TrialBalanceDocument>('TrialBalance', trialBalanceSchema);
export default TrialBalance;