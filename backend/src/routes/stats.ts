import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import Document from '../models/Document';
import EvaluationResult from '../models/EvaluationResult';
import { protect } from '../middleware/auth';

const router = Router();

let currentBudgetUSD = 10.0; // Default budget limit for demonstration

router.get('/', protect, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const [conversationCount, messageCount, documentCount, evaluationCount] = await Promise.all([
      Conversation.countDocuments({ userId }),
      Message.countDocuments({ userId }),
      Document.countDocuments({ userId }),
      EvaluationResult.countDocuments({ userId }),
    ]);

    const tokenAgg = await Message.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalInputTokens: { $sum: '$inputTokens' },
          totalOutputTokens: { $sum: '$outputTokens' },
          totalEstimatedCost: { $sum: '$estimatedCost' },
        },
      },
    ]);

    const stats = tokenAgg[0] || {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalEstimatedCost: 0,
    };

    res.json({
      conversations: conversationCount,
      messages: messageCount,
      documents: documentCount,
      evaluations: evaluationCount,
      totalInputTokens: stats.totalInputTokens,
      totalOutputTokens: stats.totalOutputTokens,
      totalCostUSD: Number(stats.totalEstimatedCost.toFixed(6)),
      budgetUSD: currentBudgetUSD,
      budgetUsedPercent: Math.min(100, Number(((stats.totalEstimatedCost / currentBudgetUSD) * 100).toFixed(2))),
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Failed to fetch stats: ' + err.message });
  }
});

// Rich Dashboard Data endpoint
router.get('/dashboard', protect, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const [
      conversationCount,
      messageCount,
      documentCount,
      evaluationCount,
      recentConversations,
      recentDocuments,
      recentEvaluations,
    ] = await Promise.all([
      Conversation.countDocuments({ userId }),
      Message.countDocuments({ userId }),
      Document.countDocuments({ userId }),
      EvaluationResult.countDocuments({ userId }),
      Conversation.find({ userId }).sort({ updatedAt: -1 }).limit(5).lean(),
      Document.find({ userId }).sort({ createdAt: -1 }).limit(5).lean(),
      EvaluationResult.find({ userId }).sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    // Token aggregation
    const tokenAgg = await Message.aggregate([
      { $match: { userId: userObjectId } },
      {
        $group: {
          _id: null,
          totalInputTokens: { $sum: '$inputTokens' },
          totalOutputTokens: { $sum: '$outputTokens' },
          totalEstimatedCost: { $sum: '$estimatedCost' },
        },
      },
    ]);

    const stats = tokenAgg[0] || {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalEstimatedCost: 0,
    };

    // Model usage distribution
    const modelDistribution = await Message.aggregate([
      { $match: { userId: userObjectId, role: 'assistant' } },
      {
        $group: {
          _id: '$model',
          count: { $sum: 1 },
          tokens: { $sum: { $add: ['$inputTokens', '$outputTokens'] } },
          cost: { $sum: '$estimatedCost' },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Provider distribution mapping
    const providerStats: Record<string, { requests: number; tokens: number; cost: number }> = {
      gemini: { requests: 0, tokens: 0, cost: 0 },
      groq: { requests: 0, tokens: 0, cost: 0 },
      openai: { requests: 0, tokens: 0, cost: 0 },
    };

    modelDistribution.forEach(m => {
      const modelName = (m._id || '').toLowerCase();
      let pKey = 'gemini';
      if (modelName.includes('groq') || modelName.includes('qwen') || modelName.includes('gpt-oss')) {
        pKey = 'groq';
      } else if (modelName.includes('openai') || modelName.includes('gpt-4o')) {
        pKey = 'openai';
      }
      providerStats[pKey].requests += m.count;
      providerStats[pKey].tokens += m.tokens;
      providerStats[pKey].cost += m.cost;
    });

    // System health indicators
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

    res.json({
      overview: {
        conversations: conversationCount,
        messages: messageCount,
        documents: documentCount,
        evaluations: evaluationCount,
        totalInputTokens: stats.totalInputTokens,
        totalOutputTokens: stats.totalOutputTokens,
        totalCostUSD: Number(stats.totalEstimatedCost.toFixed(6)),
        budgetUSD: currentBudgetUSD,
        budgetUsedPercent: Math.min(100, Number(((stats.totalEstimatedCost / currentBudgetUSD) * 100).toFixed(2))),
      },
      modelDistribution: modelDistribution.map(m => ({
        model: m._id || 'Standard',
        requests: m.count,
        tokens: m.tokens,
        costUSD: Number((m.cost || 0).toFixed(6)),
      })),
      providerStats: [
        {
          name: 'Google Gemini',
          key: 'gemini',
          requests: providerStats.gemini.requests,
          tokens: providerStats.gemini.tokens,
          costUSD: Number(providerStats.gemini.cost.toFixed(6)),
        },
        {
          name: 'Groq Cloud',
          key: 'groq',
          requests: providerStats.groq.requests,
          tokens: providerStats.groq.tokens,
          costUSD: Number(providerStats.groq.cost.toFixed(6)),
        },
        {
          name: 'OpenAI',
          key: 'openai',
          requests: providerStats.openai.requests,
          tokens: providerStats.openai.tokens,
          costUSD: Number(providerStats.openai.cost.toFixed(6)),
        },
      ],
      recentActivity: {
        conversations: recentConversations.map(c => ({
          id: c._id,
          title: c.title,
          messageCount: c.messageCount,
          updatedAt: c.updatedAt,
        })),
        documents: recentDocuments.map(d => ({
          id: d._id,
          name: d.originalFilename,
          status: d.processingStatus,
          chunks: d.chunkCount || 0,
          size: d.size,
          createdAt: d.createdAt,
        })),
        evaluations: recentEvaluations.map(e => ({
          id: e._id,
          scenarioId: e.scenarioId,
          passed: e.passed,
          tokensUsed: e.tokensUsed || 0,
          costUSD: e.costUSD || 0,
          createdAt: e.createdAt,
        })),
      },
      systemHealth: {
        backend: 'online',
        uptimeSeconds: Math.floor(process.uptime()),
        database: mongoStatus,
        environment: process.env.NODE_ENV || 'development',
      },
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Failed to fetch dashboard data: ' + err.message });
  }
});

// Update budget limit
router.post('/budget', protect, (req: Request, res: Response) => {
  const { budgetUSD } = req.body;
  if (typeof budgetUSD === 'number' && budgetUSD > 0) {
    currentBudgetUSD = budgetUSD;
    return res.json({ message: 'Budget limit updated', budgetUSD: currentBudgetUSD });
  }
  return res.status(400).json({ message: 'Invalid budget limit value' });
});

export default router;
