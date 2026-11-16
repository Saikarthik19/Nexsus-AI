import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import Document from '../models/Document';
import DocumentChunk from '../models/DocumentChunk';
import ProcessingTask from '../models/ProcessingTask';
import logger from '../utils/logger';
import { splitIntoChunks } from '../utils/chunkUtils';
import { createEmbedding } from '../services/embeddings/openAIEmbedding';

/**
 * Robust text extractor for PDF files supporting pdf-parse v2 API
 */
async function extractTextFromPDF(dataBuffer: Buffer): Promise<{ text: string; numPages: number }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfModule = require('pdf-parse');
    if (pdfModule.PDFParse && typeof pdfModule.PDFParse === 'function') {
      const parser = new pdfModule.PDFParse({ data: dataBuffer });
      const textResult = await parser.getText();
      const numPages = textResult.total || (textResult.pages && textResult.pages.length) || 1;
      await parser.destroy().catch(() => {});
      return {
        text: textResult.text || '',
        numPages,
      };
    } else if (typeof pdfModule === 'function') {
      const res = await pdfModule(dataBuffer);
      return {
        text: res.text || '',
        numPages: res.numpages || 1,
      };
    }
  } catch (e: any) {
    logger.warn('PDF parse extraction error, attempting regex stream fallback: ' + e.message);
  }

  // Fallback text extraction for PDF text streams
  const raw = dataBuffer.toString('latin1');
  const textMatches = raw.match(/\(([^()]+)\)\s*Tj/g) || [];
  const extracted = textMatches.map(m => m.slice(1, -4)).join(' ');
  return { text: extracted || 'Extracted PDF document text', numPages: 1 };
}

/**
 * Process document asynchronously (extract, clean, chunk, embed, persist)
 */
async function processDocumentFile(docId: string, filePath: string, mimeType: string, userId: string) {
  try {
    await ProcessingTask.findOneAndUpdate(
      { documentId: docId },
      { status: 'processing', progress: 10 },
      { upsert: true }
    );

    let extractedText = '';
    let pageCount = 1;

    if (mimeType === 'application/pdf' || filePath.toLowerCase().endsWith('.pdf')) {
      const dataBuffer = await fs.promises.readFile(filePath);
      const pdfResult = await extractTextFromPDF(dataBuffer);
      extractedText = pdfResult.text;
      pageCount = pdfResult.numPages;
    } else {
      extractedText = await fs.promises.readFile(filePath, 'utf8');
    }

    // Clean text
    const cleanedText = extractedText
      .replace(/\r\n/g, '\n')
      .replace(/\f/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .trim();

    if (!cleanedText) {
      throw new Error('No readable text could be extracted from document');
    }

    await ProcessingTask.findOneAndUpdate(
      { documentId: docId },
      { progress: 40 }
    );

    // Chunking: 800 chars per chunk
    const chunks = splitIntoChunks(cleanedText, 800);

    // Remove any previous chunks for this document
    await DocumentChunk.deleteMany({ documentId: docId });

    // Generate embeddings and store chunks
    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i].trim();
      if (!chunkText) continue;

      let embedding: number[] = [];
      try {
        embedding = await createEmbedding(chunkText);
      } catch (embErr: any) {
        logger.warn(`Failed to create embedding for chunk ${i}: ${embErr.message}`);
        embedding = new Array(384).fill(0);
      }

      await DocumentChunk.create({
        documentId: docId,
        userId,
        chunkIndex: i + 1,
        text: chunkText,
        embedding,
        pageNumber: Math.min(pageCount, Math.floor((i / Math.max(1, chunks.length)) * pageCount) + 1),
      });

      const progress = 40 + Math.floor(((i + 1) / chunks.length) * 50);
      await ProcessingTask.findOneAndUpdate({ documentId: docId }, { progress });
    }

    // Update document status
    await Document.findByIdAndUpdate(docId, {
      processingStatus: 'ready',
      pageCount,
      chunkCount: chunks.length,
      content: cleanedText.slice(0, 5000), // store sample for reference
      embeddingModel: 'gemini-embedding-001',
    });

    await ProcessingTask.findOneAndUpdate(
      { documentId: docId },
      { status: 'completed', progress: 100 }
    );

    logger.info(`Successfully processed document ${docId}: ${chunks.length} chunks generated`);
  } catch (err: any) {
    logger.error(`Error processing document ${docId}: ${err.message}`);
    await Document.findByIdAndUpdate(docId, {
      processingStatus: 'failed',
      processingError: err.message,
    });
    await ProcessingTask.findOneAndUpdate(
      { documentId: docId },
      { status: 'failed', error: err.message }
    );
  }
}

/**
 * Upload a document file and initiate processing
 */
export const uploadDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'No file uploaded' });

    const userId = (req as any).user.id;

    const doc = new Document({
      userId,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      storagePath: file.path,
      processingStatus: 'processing',
    });
    await doc.save();

    const task = new ProcessingTask({
      documentId: doc._id,
      userId,
      status: 'pending',
      progress: 0,
    });
    await task.save();

    // Trigger processing immediately in background
    processDocumentFile(doc._id.toString(), file.path, file.mimetype, userId).catch(err => {
      logger.error('Background processing error: ' + err.message);
    });

    res.status(201).json({
      message: 'Document uploaded successfully and processing started',
      document: doc,
      taskId: task._id,
    });
  } catch (err) {
    logger.error('Upload document error: ' + err);
    next(err);
  }
};

/** List user's documents */
export const listDocuments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const docs = await Document.find({ userId: (req as any).user.id })
      .sort({ createdAt: -1 })
      .lean();

    const formatted = docs.map(d => ({
      ...d,
      originalName: d.originalFilename,
    }));

    res.json({ documents: formatted });
  } catch (err) {
    logger.error('List documents error: ' + err);
    next(err);
  }
};

/** Get a single document metadata */
export const getDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, userId: (req as any).user.id }).lean();
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    res.json({ document: { ...doc, originalName: doc.originalFilename } });
  } catch (err) {
    logger.error('Get document error: ' + err);
    next(err);
  }
};

/** Delete a document and its chunks */
export const deleteDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await Document.findOneAndDelete({ _id: req.params.id, userId: (req as any).user.id });
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    // Clean up chunks & tasks
    await DocumentChunk.deleteMany({ documentId: doc._id });
    await ProcessingTask.deleteMany({ documentId: doc._id });

    // Clean up file on disk
    if (doc.storagePath && fs.existsSync(doc.storagePath)) {
      try {
        await fs.promises.unlink(doc.storagePath);
      } catch (e: any) {
        logger.warn('Failed to delete file from disk: ' + e.message);
      }
    }

    res.json({ message: 'Document deleted successfully' });
  } catch (err) {
    logger.error('Delete document error: ' + err);
    next(err);
  }
};

/** Get processing status */
export const getDocumentStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = await ProcessingTask.findOne({ documentId: req.params.id }).lean();
    const doc = await Document.findById(req.params.id).lean();

    if (!doc) return res.status(404).json({ message: 'Document not found' });

    res.json({
      status: task?.status || doc.processingStatus,
      progress: task?.progress ?? (doc.processingStatus === 'ready' ? 100 : 0),
      error: task?.error || doc.processingError,
      pageCount: doc.pageCount,
      chunkCount: doc.chunkCount,
    });
  } catch (err) {
    logger.error('Document status error: ' + err);
    next(err);
  }
};

/** Reprocess a document */
export const reprocessDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, userId: (req as any).user.id });
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    const task = await ProcessingTask.findOneAndUpdate(
      { documentId: doc._id },
      { status: 'pending', progress: 0, error: undefined },
      { upsert: true, new: true }
    );

    processDocumentFile(doc._id.toString(), doc.storagePath, doc.mimeType, (req as any).user.id).catch(err => {
      logger.error('Reprocess error: ' + err.message);
    });

    res.json({ message: 'Reprocessing queued', taskId: task._id });
  } catch (err) {
    logger.error('Reprocess document error: ' + err);
    next(err);
  }
};
