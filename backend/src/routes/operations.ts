import { Router, Request, Response } from 'express';
import { protect } from '../middleware/auth';
import { checkProvidersHealth, getRoutingHistory } from '../services/llm/providerRegistry';
import Approval from '../models/Approval';
import Message from '../models/Message';
import EvaluationResult from '../models/EvaluationResult';
import logger from '../utils/logger';

const router = Router();

// Live provider health check
router.get('/providers', protect, async (req: Request, res: Response) => {
  try {
    const health = await checkProvidersHealth();
    res.json({ providers: health });
  } catch (err: any) {
    logger.error('Provider health check error: ' + err.message);
    res.status(500).json({ message: 'Failed to check providers health' });
  }
});

// Routing and fallback history
router.get('/routing-history', protect, async (req: Request, res: Response) => {
  try {
    const history = getRoutingHistory();
    res.json({ history });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Security events audit (prompt injections, duplicate invoices, evaluations)
router.get('/security-events', protect, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    // 1. Messages with prompt injection detected
    const injectionMessages = await Message.find({
      userId,
      'metadata.injectionDetected': true,
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // 2. Evaluation scenario 5 (injection) and 10 (duplicate invoice) results
    const evalEvents = await EvaluationResult.find({
      userId,
      scenarioId: { $in: [5, 10] },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const formattedEvents = [
      ...injectionMessages.map(m => ({
        id: m._id.toString(),
        type: 'PROMPT_INJECTION_FLAGGED',
        severity: 'HIGH',
        description: `Potential prompt injection attack intercepted: "${m.content.slice(0, 50)}..."`,
        timestamp: m.createdAt,
      })),
      ...evalEvents.map(e => ({
        id: e._id.toString(),
        type: e.scenarioId === 5 ? 'SECURITY_TEST_INJECTION' : 'BUSINESS_RULE_DUPLICATE_INVOICE',
        severity: e.scenarioId === 5 ? 'MEDIUM' : 'HIGH',
        description:
          e.scenarioId === 5
            ? 'Evaluation test: Prompt injection pattern detected and neutralized'
            : 'Evaluation test: Duplicate invoice detected, human approval required',
        timestamp: e.createdAt,
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({ events: formattedEvents });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Approvals list (human-in-the-loop workflow)
router.get('/approvals', protect, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    let approvals = await Approval.find({ userId }).sort({ createdAt: -1 }).lean();

    // Auto-seed a demonstration approval if user has none
    if (approvals.length === 0) {
      const sample = new Approval({
        userId,
        type: 'invoice_payment',
        title: 'Enterprise AI Infrastructure Invoice #INV-9284',
        amount: 14500,
        details: {
          vendor: 'CloudCompute Global Ltd',
          category: 'High-Value Compute Allocation',
          requestedAction: 'Release Payment and Authorize Cluster Provisioning',
          requiresSignoff: true,
          thresholdRule: 'Transactions exceeding $10,000 require human authorization',
        },
        status: 'pending',
      });
      await sample.save();
      approvals = [sample.toObject() as any];
    }

    res.json({ approvals });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Decide approval (Approve or Reject)
router.post('/approvals/:id/decide', protect, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { action, reason } = req.body;

    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ message: "Action must be 'approved' or 'rejected'" });
    }

    const item = await Approval.findOne({ _id: req.params.id, userId });
    if (!item) {
      return res.status(404).json({ message: 'Approval item not found' });
    }

    item.status = action;
    item.decidedBy = (req as any).user.email || 'Admin';
    item.decisionReason = reason || `Manually ${action} by user`;
    await item.save();

    logger.info(`Human Approval: Item ${item._id} was ${action} by ${item.decidedBy}`);
    res.json({ message: `Transaction has been ${action}`, approval: item });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
