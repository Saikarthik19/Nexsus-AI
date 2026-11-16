import { Request, Response, NextFunction } from 'express';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import Document from '../models/Document';
import DocumentChunk from '../models/DocumentChunk';
import { generateWithFallback } from '../services/llm/providerRegistry';
import { createEmbedding, cosineSimilarity } from '../services/embeddings/openAIEmbedding';
import { estimateCost } from '../utils/costEstimator';
import { estimateTokens } from '../utils/tokenUtils';
import { createConversationSchema, updateConversationSchema, postMessageSchema, paginationSchema } from '../schemas/chatSchemas';
import logger from '../utils/logger';

// Helper to generate a simple title
const generateTitle = (firstUserMessage: string): string => {
  const trimmed = firstUserMessage.trim();
  if (!trimmed) return 'New Conversation';
  const snippet = trimmed.length > 30 ? trimmed.slice(0, 30) + '...' : trimmed;
  return snippet;
};

export const createConversation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = createConversationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Invalid conversation data', errors: validation.error.errors });
    }
    const { title } = validation.data;
    const conversation = new Conversation({
      userId: (req as any).user.id,
      title: title?.trim() || 'Untitled Conversation',
    });
    await conversation.save();
    res.status(201).json({ conversation });
  } catch (err) {
    logger.error('Create conversation error: ' + err);
    next(err);
  }
};

export const getConversations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, search } = paginationSchema.parse(req.query);
    const filter: any = { userId: (req as any).user.id };
    if (search) {
      filter.$text = { $search: search };
    }
    const conversations = await Conversation.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    const total = await Conversation.countDocuments(filter);
    res.json({ conversations, total, page, limit });
  } catch (err) {
    logger.error('Get conversations error: ' + err);
    next(err);
  }
};

export const getConversationById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conv = await Conversation.findOne({ _id: req.params.id, userId: (req as any).user.id }).lean();
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });
    res.json({ conversation: conv });
  } catch (err) {
    logger.error('Get conversation error: ' + err);
    next(err);
  }
};

export const updateConversation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = updateConversationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Invalid data', errors: validation.error.errors });
    }
    const conv = await Conversation.findOneAndUpdate(
      { _id: req.params.id, userId: (req as any).user.id },
      { title: validation.data.title },
      { new: true }
    ).lean();
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });
    res.json({ conversation: conv });
  } catch (err) {
    logger.error('Update conversation error: ' + err);
    next(err);
  }
};

export const deleteConversation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conv = await Conversation.findOneAndDelete({ _id: req.params.id, userId: (req as any).user.id });
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });
    // cascade delete messages
    await Message.deleteMany({ conversationId: conv._id });
    res.json({ message: 'Conversation deleted' });
  } catch (err) {
    logger.error('Delete conversation error: ' + err);
    next(err);
  }
};

export const postMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = postMessageSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Invalid message', errors: validation.error.errors });
    }
    const { content, model: requestedModel, useRAG, documentId } = validation.data;
    const userId = (req as any).user.id;
    const conversationId = req.params.id;

    // Ensure conversation belongs to user
    const conversation = await Conversation.findOne({ _id: conversationId, userId });
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Stage 1: Security & Injection Detection
    const injectionPattern = /ignore\s+previous\s+instructions|you\s+are\s+now|execute\s+.*command|system:\s*.*$/i;
    const injectionDetected = injectionPattern.test(content);

    // Stage 2: RAG Context Retrieval (if requested)
    let promptToRun = content;
    let ragSources: Array<{ documentName: string; page?: number; similarity?: number; snippet?: string }> = [];

    if (useRAG) {
      try {
        const queryFilter: any = { userId };
        if (documentId) {
          queryFilter.documentId = documentId;
        }

        const chunks = await DocumentChunk.find(queryFilter).populate('documentId', 'originalFilename').lean();

        if (chunks && chunks.length > 0) {
          const queryVec = await createEmbedding(content);
          const scored = chunks.map(chunk => {
            const sim = cosineSimilarity(queryVec, chunk.embedding || []);
            const docName = (chunk.documentId as any)?.originalFilename || 'Document';
            return {
              text: chunk.text,
              similarity: sim,
              docName,
              pageNumber: chunk.pageNumber,
            };
          });

          // Sort by similarity descending
          scored.sort((a, b) => b.similarity - a.similarity);
          const topChunks = scored.slice(0, 4);

          ragSources = topChunks.map(c => ({
            documentName: c.docName,
            page: c.pageNumber,
            similarity: Number(c.similarity.toFixed(4)),
            snippet: c.text.slice(0, 120) + (c.text.length > 120 ? '...' : ''),
          }));

          const contextBlock = topChunks
            .map((c, i) => `[Source ${i + 1} - ${c.docName} (Page ${c.pageNumber || 1})]:\n${c.text}`)
            .join('\n\n');

          promptToRun = `You are NexusAI, an intelligent knowledge assistant. Answer the user question accurately based on the retrieved document context below.\nGround your response strictly on this context. Cite the sources where appropriate. If the context does not contain the answer, state that clearly.\n\n=== RETRIEVED DOCUMENT CONTEXT ===\n${contextBlock}\n===================================\n\nUser Question: ${content}`;
        }
      } catch (ragErr: any) {
        logger.warn('RAG retrieval failed: ' + ragErr.message);
      }
    }

    // Stage 3: LLM Generation via Multi-Model Router with Fallback
    const estimatedInputTokens = estimateTokens(promptToRun);
    let llmResp;
    try {
      llmResp = await generateWithFallback(promptToRun, {
        prompt: promptToRun,
        tokenCount: estimatedInputTokens,
        forceModel: requestedModel && requestedModel !== 'auto' ? requestedModel : undefined,
        isRAG: !!useRAG,
        taskType: useRAG ? 'rag' : 'chat',
      });
    } catch (llmErr: any) {
      logger.error('LLM generation error: ' + llmErr.message);
      return res.status(503).json({
        message: 'All AI model providers failed to respond. Please check API keys or try again.',
        error: llmErr.message,
      });
    }

    const estimatedCost = estimateCost(llmResp.inputTokens, llmResp.outputTokens, llmResp.routedModel);

    // Save user message
    const userMessage = new Message({
      conversationId,
      userId,
      role: 'user',
      content,
      model: llmResp.routedModel,
      inputTokens: estimateTokens(content),
      outputTokens: 0,
      estimatedCost: 0,
      status: 'sent',
      metadata: {
        injectionDetected,
      },
    });
    await userMessage.save();

    // Save assistant message with complete routing & telemetry metadata
    const assistantMessage = new Message({
      conversationId,
      userId,
      role: 'assistant',
      content: llmResp.content,
      model: llmResp.routedModel,
      inputTokens: llmResp.inputTokens,
      outputTokens: llmResp.outputTokens,
      estimatedCost,
      status: 'sent',
      metadata: {
        provider: llmResp.routedProvider,
        routingMode: llmResp.routingMode,
        routingReason: llmResp.routingReason,
        taskCategory: llmResp.taskCategory,
        fallbackUsed: llmResp.fallbackUsed,
        fallbackReason: llmResp.fallbackReason,
        sources: ragSources.length > 0 ? ragSources : undefined,
      },
    });
    await assistantMessage.save();

    // Update conversation metadata
    conversation.messageCount += 2;
    if (conversation.messageCount <= 2) {
      conversation.title = generateTitle(content);
    }
    conversation.updatedAt = new Date();
    await conversation.save();

    res.status(201).json({
      userMessage,
      assistantMessage,
      routing: {
        model: llmResp.routedModel,
        provider: llmResp.routedProvider,
        routingMode: llmResp.routingMode,
        routingReason: llmResp.routingReason,
        taskCategory: llmResp.taskCategory,
        fallbackUsed: llmResp.fallbackUsed,
        fallbackReason: llmResp.fallbackReason,
        sources: ragSources,
      },
    });
  } catch (err) {
    logger.error('Post message error: ' + err);
    next(err);
  }
};

export const getMessages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const conversationId = req.params.id;
    const userId = (req as any).user.id;
    // Verify ownership
    const conv = await Conversation.findOne({ _id: conversationId, userId });
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });
    const messages = await Message.find({ conversationId })
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    const total = await Message.countDocuments({ conversationId });
    res.json({ messages, total, page, limit });
  } catch (err) {
    logger.error('Get messages error: ' + err);
    next(err);
  }
};
