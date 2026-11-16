import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IProcessingTask extends Document {
  documentId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProcessingTaskSchema: Schema<IProcessingTask> = new mongoose.Schema(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
    progress: { type: Number, default: 0 },
    error: { type: String },
  },
  { timestamps: true }
);

const ProcessingTask: Model<IProcessingTask> = mongoose.model<IProcessingTask>('ProcessingTask', ProcessingTaskSchema);
export default ProcessingTask;
