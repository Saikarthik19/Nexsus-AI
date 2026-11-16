import { z } from 'zod';

export const createConversationSchema = z.object({
  title: z.string().trim().min(1).max(200).optional().or(z.literal('')),
});

export const updateConversationSchema = z.object({
  title: z.string().min(1).max(200),
});

export const postMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  model: z.string().optional(),
  useRAG: z.boolean().optional(),
  documentId: z.string().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});
