import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IApproval extends Document {
  userId: mongoose.Types.ObjectId;
  type: string;
  title: string;
  amount?: number;
  details: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected';
  decidedBy?: string;
  decisionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ApprovalSchema: Schema<IApproval> = new mongoose.Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, default: 'invoice_payment' },
    title: { type: String, required: true },
    amount: { type: Number },
    details: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    decidedBy: { type: String },
    decisionReason: { type: String },
  },
  { timestamps: true }
);

const Approval: Model<IApproval> = mongoose.model<IApproval>('Approval', ApprovalSchema);
export default Approval;
