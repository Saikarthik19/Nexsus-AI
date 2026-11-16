import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IDocumentChunk extends Document {
  documentId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  chunkIndex: number;
  text: string;
  embedding: number[]; // vector
  pageNumber?: number;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentChunkSchema: Schema<IDocumentChunk> = new mongoose.Schema(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    chunkIndex: { type: Number, required: true },
    text: { type: String, required: true },
    embedding: { type: [Number], required: true },
    pageNumber: { type: Number },
  },
  { timestamps: true }
);

DocumentChunkSchema.index({ documentId: 1, chunkIndex: 1 });
DocumentChunkSchema.index({ embedding: '2dsphere' }); // placeholder for vector search (MongoDB Atlas vector index)

const DocumentChunk: Model<IDocumentChunk> = mongoose.model<IDocumentChunk>('DocumentChunk', DocumentChunkSchema);
export default DocumentChunk;
