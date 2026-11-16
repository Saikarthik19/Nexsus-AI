// Document model with optional full text content
import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IDocument extends Document {
  userId: mongoose.Types.ObjectId;
  originalFilename: string;
  mimeType: string;
  size: number; // in bytes
  storagePath: string; // absolute path on disk
  processingStatus: 'uploaded' | 'processing' | 'ready' | 'failed';
  pageCount?: number;
  chunkCount?: number;
  embeddingModel?: string;
  processingError?: string;
  createdAt: Date;
  updatedAt: Date;
  content?: string; // optional full text for evaluation
}

const DocumentSchema: Schema<IDocument> = new mongoose.Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    originalFilename: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    storagePath: { type: String, required: true },
    processingStatus: { type: String, enum: ['uploaded', 'processing', 'ready', 'failed'], default: 'uploaded' },
    pageCount: { type: Number },
    chunkCount: { type: Number },
    embeddingModel: { type: String },
    processingError: { type: String },
    content: { type: String },
  },
  { timestamps: true },
);

DocumentSchema.index({ userId: 1, originalFilename: 'text' });

const DocumentModel: Model<IDocument> = mongoose.model<IDocument>('Document', DocumentSchema);
export default DocumentModel;
