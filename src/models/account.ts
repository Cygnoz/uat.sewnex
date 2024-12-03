
import { Schema, Document, model } from 'mongoose';

export interface AccountDocument extends Document {
    _id: string;
    organizationId: string;
    
    accountName: string;
    accountCode: string;
    accountId: string;
    
    accountSubhead: string;
    accountHead: string;
    accountGroup: string;
    
    bankAccNum: string;
    bankIfsc: string;
    bankCurrency: string;
    
    description: string;
    
    createdDate: Date; 
    createdTime: string; 
}

const accountSchema = new Schema<AccountDocument>({
    organizationId: { type: String, required: true },
    
    accountName: { type: String, required: true },
    accountCode: { type: String, required: true },
    accountId: { type: String, required: true },
    
    accountSubhead: { type: String, required: true },
    accountHead: { type: String, required: true },
    accountGroup: { type: String, required: true },
    
    bankAccNum: { type: String },
    bankIfsc: { type: String },
    bankCurrency: { type: String },

    description: { type: String },

    createdDate: { type: Date, default: () => new Date().setHours(0, 0, 0, 0) }, // Only the date part
    createdTime: { type: String, default: () => new Date().toTimeString().split(' ')[0] }, // Only the time part
});

const Account = model<AccountDocument>('Accounts', accountSchema);
export default Account;
