import { Schema, Document, model } from 'mongoose';

// Define the ContactPerson interface
interface ContactPerson {
    salutation?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    mobile?: string;
}

// Extend the Mongoose Document interface for the Customer type
export interface CustomerDocument extends Document {
    organizationId: string;
    customerType?: string;
    customerProfile?: string;
    debitOpeningBalance?: number;
    creditOpeningBalance?: number;
    salutation?: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
    customerDisplayName?: string;
    customerEmail?: string;
    workPhone?: string;
    mobile?: string;
    dob?: string;
    cardNumber?: string;
    pan?: string;
    currency?: string;
    creditDays?: number;
    creditLimits?: number;
    interestPercentage?: number;
    paymentTerms?: string;
    enablePortal?: boolean;
    documents?: string;
    department?: string;
    designation?: string;
    websiteURL?: string;
    taxReason?: string;
    taxType?: string;
    gstTreatment?: string;
    gstin_uin?: string;
    placeOfSupply?: string;
    businessLegalName?: string;
    businessTradeName?: string;
    vatNumber?: string;
    billingAttention?: string;
    billingCountry?: string;
    billingAddressLine1?: string;
    billingAddressLine2?: string;
    billingCity?: string;
    billingState?: string;
    billingPinCode?: string;
    billingPhone?: string;
    billingFaxNumber?: string;
    shippingAttention?: string;
    shippingCountry?: string;
    shippingAddress1?: string;
    shippingAddress2?: string;
    shippingCity?: string;
    shippingState?: string;
    shippingPinCode?: string;
    shippingPhone?: string;
    shippingFaxNumber?: string;
    contactPerson?: ContactPerson[];
    remark?: string;
    status?: string;
    lastModifiedDate?: string;
    
    createdDate: Date; 
    createdTime: string; 
}

// Define the ContactPerson schema
const contactPersonSchema = new Schema<ContactPerson>({
    salutation: { type: String },
    firstName: { type: String },
    lastName: { type: String },
    email: { type: String },
    mobile: { type: String },
}, { _id: false });

// Define the Customer schema
const customerSchema = new Schema<CustomerDocument>({
    organizationId: { type: String, required: true },
    customerType: { type: String, required: true },
    customerProfile: { type: String },
    debitOpeningBalance: { type: Number },
    creditOpeningBalance: { type: Number },
    salutation: { type: String },
    firstName: { type: String },
    lastName: { type: String },
    companyName: { type: String },
    customerDisplayName: { type: String, required: true },
    customerEmail: { type: String },
    workPhone: { type: String },
    mobile: { type: String },
    dob: { type: String },
    cardNumber: { type: String },
    pan: { type: String },
    currency: { type: String },
    creditDays: { type: Number },
    creditLimits: { type: Number },
    interestPercentage: { type: Number },
    paymentTerms: { type: String },
    enablePortal: { type: Boolean },
    documents: { type: String },
    department: { type: String },
    designation: { type: String },
    websiteURL: { type: String },
    taxReason: { type: String },
    taxType: { type: String },
    gstTreatment: { type: String },
    gstin_uin: { type: String },
    placeOfSupply: { type: String },
    businessLegalName: { type: String },
    businessTradeName: { type: String },
    vatNumber: { type: String },
    billingAttention: { type: String },
    billingCountry: { type: String },
    billingAddressLine1: { type: String },
    billingAddressLine2: { type: String },
    billingCity: { type: String },
    billingState: { type: String },
    billingPinCode: { type: String },
    billingPhone: { type: String },
    billingFaxNumber: { type: String },
    shippingAttention: { type: String },
    shippingCountry: { type: String },
    shippingAddress1: { type: String },
    shippingAddress2: { type: String },
    shippingCity: { type: String },
    shippingState: { type: String },
    shippingPinCode: { type: String },
    shippingPhone: { type: String },
    shippingFaxNumber: { type: String },
    contactPerson: [contactPersonSchema],
    remark: { type: String },
    status: { type: String },
    lastModifiedDate: { type: String },

    createdDate: { type: Date, default: () => new Date().setHours(0, 0, 0, 0) }, // Only the date part
    createdTime: { type: String, default: () => new Date().toTimeString().split(' ')[0] }, // Only the time part
});

const Customer = model<CustomerDocument>('Customer', customerSchema);
export default Customer;
