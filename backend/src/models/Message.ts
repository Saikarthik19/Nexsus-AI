import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IMessage {
  conversationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: 'user' | 'assistant';
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  status: 'sent' | 'error';
  metadata?: {
    sources?: Array<{ documentName: string; page?: number; similarity?: number; snippet?: string }>;
    fallbackUsed?: boolean;
    provider?: string;
    injectionDetected?: boolean;
  };
  createdAt: Date;
}

const MessageSchema: Schema<IMessage> = new mongoose.Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    model: { type: String, default: 'gemini-3.5-flash-lite' },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    estimatedCost: { type: Number, default: 0 },
    status: { type: String, enum: ['sent', 'error'], default: 'sent' },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

MessageSchema.index({ conversationId: 1, createdAt: 1 });

const Message: Model<IMessage> = mongoose.model<IMessage>('Message', MessageSchema);
export default Message;
