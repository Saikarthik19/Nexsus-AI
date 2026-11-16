import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IConversation extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema: Schema<IConversation> = new mongoose.Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    messageCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ConversationSchema.index({ userId: 1, title: 'text' });

const Conversation: Model<IConversation> = mongoose.model<IConversation>('Conversation', ConversationSchema);
export default Conversation;
