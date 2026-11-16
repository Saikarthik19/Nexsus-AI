import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { estimateTokens } from '../../utils/tokenUtils';
import logger from '../../utils/logger';

/** Provider class for OpenAI embeddings */
export class OpenAIEmbeddingProvider {
  private client: OpenAI | null = null;
  private model: string;

  constructor(model = 'text-embedding-3-small') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }
    this.model = model;
  }

  /** Embed a text string and return the vector */
  async embedText(text: string): Promise<number[]> {
    if (!this.client) throw new Error('OPENAI_API_KEY not configured');
    try {
      const resp = await this.client.embeddings.create({
        model: this.model,
        input: text,
      });
      return resp.data[0].embedding as number[];
    } catch (err: any) {
      logger.error('OpenAI embedding error: ' + (err.message || err));
      throw err;
    }
  }

  /** Approximate cost for an embedding request (per 1M tokens) */
  estimateEmbeddingCost(text: string): number {
    const tokens = estimateTokens(text);
    const costPerMillion = 0.02; // $0.02 per 1M tokens
    return (tokens / 1_000_000) * costPerMillion;
  }
}

/** Provider class for Gemini embeddings */
export class GeminiEmbeddingProvider {
  private genAI: GoogleGenerativeAI | null = null;
  private modelName = 'gemini-embedding-001';

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  async embedText(text: string): Promise<number[]> {
    if (!this.genAI) throw new Error('GEMINI_API_KEY not configured');
    try {
      const model = this.genAI.getGenerativeModel({ model: this.modelName });
      const res = await model.embedContent(text);
      return res.embedding.values;
    } catch (err: any) {
      logger.error('Gemini embedding error: ' + (err.message || err));
      throw err;
    }
  }
}

/** Deterministic local hash vector fallback (384 dimensions) if external APIs fail or are offline */
export function generateLocalEmbedding(text: string, dim = 384): number[] {
  const vec = new Array(dim).fill(0);
  const words = text.toLowerCase().split(/\W+/).filter(Boolean);
  if (words.length === 0) return vec;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let hash = 0;
    for (let c = 0; c < word.length; c++) {
      hash = (hash << 5) - hash + word.charCodeAt(c);
      hash |= 0;
    }
    const idx = Math.abs(hash) % dim;
    vec[idx] += 1;
  }

  // Normalize
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) vec[i] /= norm;
  }
  return vec;
}

/** Compute cosine similarity between two vector embeddings */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  const len = Math.min(vecA.length, vecB.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Unified embedding generation with automated multi-tier fallback */
export async function createEmbedding(text: string): Promise<number[]> {
  // Tier 1: Try Gemini embedding (primary working provider)
  if (process.env.GEMINI_API_KEY) {
    try {
      const geminiEmbedder = new GeminiEmbeddingProvider();
      return await geminiEmbedder.embedText(text);
    } catch (err: any) {
      logger.warn(`Gemini embedding failed (${err.message}), falling back...`);
    }
  }

  // Tier 2: Try OpenAI embedding
  if (process.env.OPENAI_API_KEY) {
    try {
      const openAiEmbedder = new OpenAIEmbeddingProvider();
      return await openAiEmbedder.embedText(text);
    } catch (err: any) {
      logger.warn(`OpenAI embedding failed (${err.message}), falling back...`);
    }
  }

  // Tier 3: Local deterministic vector fallback
  logger.info('Using local deterministic embedding fallback');
  return generateLocalEmbedding(text);
}
