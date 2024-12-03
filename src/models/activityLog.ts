
import { Schema, Document, model } from 'mongoose';

export interface ActivityLogDocument extends Document {
    _id: string;
    userName: string;
    activity: string;
    createdDate: Date; 
    createdTime: string; 
    reqBody: string;
}

const activityLogSchema = new Schema<ActivityLogDocument>({
    userName: { type: String, required: true },
    activity: { type: String, required: true },
    createdDate: { type: Date, default: () => new Date().setHours(0, 0, 0, 0) }, // Only the date part
    createdTime: { type: String, default: () => new Date().toTimeString().split(' ')[0] }, // Only the time part
    reqBody: { type: String, default: undefined }
});

const ActivityLog = model<ActivityLogDocument>('ActivityLog', activityLogSchema);
export default ActivityLog;
