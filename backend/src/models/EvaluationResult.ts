import mongoose, { Document, Schema } from 'mongoose';

export interface IEvaluationResult extends Document {
  userId: string;
  scenarioId: number; // 1-10
  passed: boolean;
  details: string; // JSON string of result details
  createdAt: Date;
  tokensUsed?: number;
  costUSD?: number;
}

const EvaluationResultSchema = new Schema<IEvaluationResult>({
  userId: { type: String, required: true, index: true },
  scenarioId: { type: Number, required: true },
  passed: { type: Boolean, required: true },
  details: { type: String, required: true },
  tokensUsed: { type: Number },
  costUSD: { type: Number },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<IEvaluationResult>('EvaluationResult', EvaluationResultSchema);