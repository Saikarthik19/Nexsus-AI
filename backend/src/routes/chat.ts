import { Router } from 'express';
import {
  createConversation,
  getConversations,
  getConversationById,
  updateConversation,
  deleteConversation,
  postMessage,
  getMessages,
} from '../controllers/chatController';
import { protect } from '../middleware/auth';

const router = Router();

// Conversation CRUD
router.post('/conversations', protect, createConversation);
router.get('/conversations', protect, getConversations);
router.get('/conversations/:id', protect, getConversationById);
router.patch('/conversations/:id', protect, updateConversation);
router.delete('/conversations/:id', protect, deleteConversation);

// Messages within a conversation
router.post('/conversations/:id/messages', protect, postMessage);
router.get('/conversations/:id/messages', protect, getMessages);

export default router;
