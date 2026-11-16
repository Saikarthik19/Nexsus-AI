import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from backend root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

import GeminiProvider from './geminiProvider';
import GroqProvider from './groqProvider';
import OpenAIProvider from './thirdProvider';
import { Provider, LLMResponse } from './llmTypes';
import logger from '../../utils/logger';

export interface ModelInfo {
  provider: Provider;
  modelName: string;
  providerName: 'gemini' | 'groq' | 'openai';
  capabilities: string[];
  contextWindow: number; // token limit
  pricing: { input: number; output: number }; // $ per 1M tokens
  speed: 'fast' | 'balanced' | 'high';
}

export interface RoutingEvent {
  id: string;
  timestamp: string;
  taskType: string;
  promptSnippet: string;
  primaryModel: string;
  primaryProvider: string;
  routedModel: string;
  routedProvider: string;
  fallbackUsed: boolean;
  fallbackReason?: string;
  tokensUsed: number;
  costUSD: number;
  status: 'success' | 'failed';
}

export interface RoutingCriteria {
  prompt?: string;
  tokenCount?: number;
  forceModel?: string;
  isRAG?: boolean;
  taskType?: string;
}

export interface TaskAnalysis {
  category: 'code' | 'fast_query' | 'rag_document' | 'reasoning' | 'creative' | 'general';
  routingReason: string;
  modelInfo: ModelInfo;
  routingMode: 'auto' | 'manual';
}

const routingHistory: RoutingEvent[] = [];

// Initialise providers once (reuse across requests)
const registry: ModelInfo[] = [
  {
    provider: new GeminiProvider('gemini-3.5-flash-lite'),
    modelName: 'gemini-3.5-flash-lite',
    providerName: 'gemini',
    capabilities: ['fast', 'low-cost', 'multimodal', 'long-context'],
    contextWindow: 1_000_000,
    pricing: { input: 0.075, output: 0.30 },
    speed: 'fast',
  },
  {
    provider: new GroqProvider('qwen/qwen3.8-27b'),
    modelName: 'qwen/qwen3.8-27b',
    providerName: 'groq',
    capabilities: ['balanced', 'ultra-fast-inference', 'code-specialist'],
    contextWindow: 131072,
    pricing: { input: 0.05, output: 0.08 },
    speed: 'balanced',
  },
  {
    provider: new OpenAIProvider('gpt-4o-mini'),
    modelName: 'gpt-4o-mini',
    providerName: 'openai',
    capabilities: ['high-quality', 'reasoning', 'analytical'],
    contextWindow: 128000,
    pricing: { input: 0.15, output: 0.60 },
    speed: 'high',
  },
];

/**
 * Intelligent task-aware classifier and model selector
 */
export function classifyTaskAndSelectModel(criteria: RoutingCriteria): TaskAnalysis {
  const prompt = (criteria.prompt || '').trim();
  const tokenCount = criteria.tokenCount ?? Math.ceil(prompt.length / 4);

  // 1. Manual User Selection
  if (criteria.forceModel && criteria.forceModel !== 'auto') {
    const forced = registry.find(
      m => m.modelName.toLowerCase() === criteria.forceModel?.toLowerCase() ||
           m.providerName.toLowerCase() === criteria.forceModel?.toLowerCase()
    );
    if (forced) {
      return {
        category: 'general',
        routingMode: 'manual',
        routingReason: `Manual User Selection: User pinned execution to ${forced.providerName.toUpperCase()} (${forced.modelName}).`,
        modelInfo: forced,
      };
    }
  }

  // 2. Automated Task-Aware Routing Decisions

  // A. RAG Document Intelligence / Very Large Context
  if (criteria.isRAG || criteria.taskType === 'rag' || tokenCount > 1500) {
    const gemini = registry.find(m => m.providerName === 'gemini') || registry[0];
    return {
      category: 'rag_document',
      routingMode: 'auto',
      routingReason: 'Task Classified: Document Intelligence & RAG Retrieval. Routed to Google Gemini for 1,000,000-token context window and grounded synthesis.',
      modelInfo: gemini,
    };
  }

  // B. Code Generation, Programming & Technical Implementation
  const codeKeywords = /\b(code|python|javascript|typescript|java|c\+\+|rust|golang|php|ruby|swift|sql|html|css|function|algorithm|class|regex|json|debug|syntax|api|endpoint|git|bash|shell|script|program|def|import|const|let|var|return|loop|array|object|promise|async|await)\b/i;
  const hasCodeSyntax = /```|=>|\{|\}|;\s*$/.test(prompt);
  if (codeKeywords.test(prompt) || hasCodeSyntax) {
    const groq = registry.find(m => m.providerName === 'groq') || registry[1];
    return {
      category: 'code',
      routingMode: 'auto',
      routingReason: 'Task Classified: Code Generation & Technical Problem Solving. Routed to Groq Cloud (Qwen 27B) for syntax precision and low-latency instruction execution.',
      modelInfo: groq,
    };
  }

  // C. Speed-Critical / Short Conversational / Factual Lookups
  const shortGreetings = /^(hi|hello|hey|good morning|good evening|who are you|help|thank you|thanks|how are you|tell me a joke|quick question|define)\b/i;
  if (shortGreetings.test(prompt) || (tokenCount < 25 && !/\b(write|essay|story|poem)\b/i.test(prompt))) {
    const groq = registry.find(m => m.providerName === 'groq') || registry[1];
    return {
      category: 'fast_query',
      routingMode: 'auto',
      routingReason: 'Task Classified: Fast Conversational / Real-Time Query. Routed to Groq Cloud for sub-400ms ultra-low latency response.',
      modelInfo: groq,
    };
  }

  // D. Complex Multi-Step Reasoning, Analytical Comparison & Logic
  const reasoningKeywords = /\b(analyze|analysis|compare|contrast|evaluate|pros and cons|logic|reasoning|deduce|trade-offs|strategy|decision|dilemma|critique|philosophical)\b/i;
  if (reasoningKeywords.test(prompt)) {
    const openai = registry.find(m => m.providerName === 'openai');
    return {
      category: 'reasoning',
      routingMode: 'auto',
      routingReason: 'Task Classified: Complex Multi-Step Reasoning & Comparative Analysis. Primary target: OpenAI (GPT-4o-mini).',
      modelInfo: openai || registry[0],
    };
  }

  // E. Creative Writing, Brainstorming & Long-Form Composition
  const creativeKeywords = /\b(write|draft|essay|story|poem|creative|brainstorm|ideas|metaphor|marketing|pitch|article|blog|speech|compose)\b/i;
  if (creativeKeywords.test(prompt)) {
    const gemini = registry.find(m => m.providerName === 'gemini') || registry[0];
    return {
      category: 'creative',
      routingMode: 'auto',
      routingReason: 'Task Classified: Creative Generation & Long-Form Synthesis. Routed to Google Gemini for expressive multi-turn composition.',
      modelInfo: gemini,
    };
  }

  // F. General Knowledge / Balanced Execution
  const groq = registry.find(m => m.providerName === 'groq') || registry[1];
  return {
    category: 'general',
    routingMode: 'auto',
    routingReason: 'Task Classified: General Conversational Assistant. Routed to Groq Cloud for high throughput and speed.',
    modelInfo: groq,
  };
}

export const findModel = (criteria: RoutingCriteria = {}): ModelInfo => {
  const analysis = classifyTaskAndSelectModel(criteria);
  return analysis.modelInfo;
};

export const getAllModels = () =>
  registry.map(m => ({
    modelName: m.modelName,
    provider: m.provider.name,
    contextWindow: m.contextWindow,
    pricing: m.pricing,
    capabilities: m.capabilities,
    speed: m.speed,
  }));

export const recordRoutingEvent = (event: Omit<RoutingEvent, 'id' | 'timestamp'>) => {
  const fullEvent: RoutingEvent = {
    ...event,
    id: `route_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  routingHistory.unshift(fullEvent);
  if (routingHistory.length > 100) {
    routingHistory.pop();
  }
  return fullEvent;
};

export const getRoutingHistory = () => routingHistory;

export const generateWithFallback = async (
  prompt: string,
  criteria: RoutingCriteria = {}
): Promise<LLMResponse & {
  fallbackUsed: boolean;
  fallbackReason?: string;
  originalError?: string;
  routedModel: string;
  routedProvider: string;
  routingMode: 'auto' | 'manual';
  routingReason: string;
  taskCategory: string;
}> => {
  const criteriaWithPrompt: RoutingCriteria = { ...criteria, prompt };
  const taskAnalysis = classifyTaskAndSelectModel(criteriaWithPrompt);
  const primary = taskAnalysis.modelInfo;
  const promptSnippet = prompt.slice(0, 50).replace(/[\r\n]+/g, ' ') + (prompt.length > 50 ? '...' : '');

  // Step 4: Add required backend debug logs
  console.log(`[ROUTER] Incoming task: ${taskAnalysis.category} ("${promptSnippet}")`);
  console.log(`[ROUTER] Routing mode: ${taskAnalysis.routingMode}`);
  console.log(`[ROUTER] Routing reason: ${taskAnalysis.routingReason}`);
  console.log(`[ROUTER] Selected provider: ${primary.providerName}`);
  console.log(`[ROUTER] Selected model: ${primary.modelName}`);
  console.log(`[PROVIDER] Actual provider called: ${primary.providerName} (${primary.modelName})`);

  try {
    const resp = await primary.provider.generateResponse(prompt);
    console.log(`[PROVIDER] API request result: SUCCESS from ${primary.providerName}`);
    console.log(`[RESPONSE] Actual provider returned: ${primary.providerName} (${primary.modelName})`);

    const tokensUsed = (resp.inputTokens || 0) + (resp.outputTokens || 0);
    const costUSD = (resp.inputTokens * primary.pricing.input + resp.outputTokens * primary.pricing.output) / 1_000_000;

    recordRoutingEvent({
      taskType: taskAnalysis.category,
      promptSnippet,
      primaryModel: primary.modelName,
      primaryProvider: primary.providerName,
      routedModel: primary.modelName,
      routedProvider: primary.providerName,
      fallbackUsed: false,
      tokensUsed,
      costUSD,
      status: 'success',
    });

    return {
      ...resp,
      routedModel: primary.modelName,
      routedProvider: primary.providerName,
      routingMode: taskAnalysis.routingMode,
      routingReason: taskAnalysis.routingReason,
      taskCategory: taskAnalysis.category,
      fallbackUsed: false,
    };
  } catch (err: any) {
    console.log(`[PROVIDER] API request result: FAILURE from ${primary.providerName} (${err.message})`);
    logger.warn(`Primary provider ${primary.providerName} (${primary.modelName}) failed: ${err.message}. Initiating fallback...`);

    // Determine fallback order: try remaining registered models
    const fallbacks = registry.filter(m => m.modelName !== primary.modelName);
    for (const fb of fallbacks) {
      console.log(`[FALLBACK] Fallback provider: ${fb.providerName} (${fb.modelName})`);
      console.log(`[PROVIDER] Actual provider called: ${fb.providerName} (${fb.modelName})`);
      try {
        const resp = await fb.provider.generateResponse(prompt);
        console.log(`[PROVIDER] API request result: SUCCESS from fallback ${fb.providerName}`);
        console.log(`[RESPONSE] Actual provider returned: ${fb.providerName} (${fb.modelName})`);

        const tokensUsed = (resp.inputTokens || 0) + (resp.outputTokens || 0);
        const costUSD = (resp.inputTokens * fb.pricing.input + resp.outputTokens * fb.pricing.output) / 1_000_000;

        recordRoutingEvent({
          taskType: taskAnalysis.category,
          promptSnippet,
          primaryModel: primary.modelName,
          primaryProvider: primary.providerName,
          routedModel: fb.modelName,
          routedProvider: fb.providerName,
          fallbackUsed: true,
          fallbackReason: `${primary.providerName.toUpperCase()} error: ${err.message}`,
          tokensUsed,
          costUSD,
          status: 'success',
        });

        return {
          ...resp,
          fallbackUsed: true,
          fallbackReason: `${primary.providerName.toUpperCase()} unavailable (${err.message}). Automatically failed over to ${fb.providerName.toUpperCase()}.`,
          originalError: err.message,
          routedModel: fb.modelName,
          routedProvider: fb.providerName,
          routingMode: taskAnalysis.routingMode,
          routingReason: `${taskAnalysis.routingReason} [Fallback triggered]`,
          taskCategory: taskAnalysis.category,
        };
      } catch (fbErr: any) {
        console.log(`[PROVIDER] API request result: FAILURE from fallback ${fb.providerName} (${fbErr.message})`);
        logger.warn(`Fallback ${fb.providerName} (${fb.modelName}) also failed: ${fbErr.message}`);
      }
    }

    recordRoutingEvent({
      taskType: taskAnalysis.category,
      promptSnippet,
      primaryModel: primary.modelName,
      primaryProvider: primary.providerName,
      routedModel: 'none',
      routedProvider: 'none',
      fallbackUsed: true,
      fallbackReason: err.message,
      tokensUsed: 0,
      costUSD: 0,
      status: 'failed',
    });

    throw new Error(`All available LLM providers failed to generate a response. Primary error: ${err.message}`);
  }
};

/** Live health check for Gemini, Groq, and OpenAI */
export const checkProvidersHealth = async () => {
  const results = [];

  // 1. Gemini
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;
  let geminiStatus: 'online' | 'degraded' | 'offline' = 'offline';
  let geminiLatency = 0;
  let geminiError = '';
  if (hasGeminiKey) {
    const t0 = Date.now();
    try {
      const gemini = new GeminiProvider('gemini-3.5-flash-lite');
      const ok = await gemini.healthCheck();
      geminiLatency = Date.now() - t0;
      geminiStatus = ok ? 'online' : 'degraded';
    } catch (e: any) {
      geminiLatency = Date.now() - t0;
      geminiStatus = 'offline';
      geminiError = e.message || 'Connection failed';
    }
  }

  results.push({
    name: 'Google Gemini',
    providerKey: 'gemini',
    configured: hasGeminiKey,
    status: geminiStatus,
    latencyMs: geminiLatency,
    activeModel: 'gemini-3.5-flash-lite',
    models: ['gemini-3.5-flash-lite', 'gemini-embedding-001'],
    contextWindow: '1,000,000 tokens',
    pricing: '$0.075 / 1M input',
    error: geminiError || undefined,
  });

  // 2. Groq
  const hasGroqKey = !!process.env.GROQ_API_KEY;
  let groqStatus: 'online' | 'degraded' | 'offline' = 'offline';
  let groqLatency = 0;
  let groqError = '';
  if (hasGroqKey) {
    const t0 = Date.now();
    try {
      const groq = new GroqProvider('qwen/qwen3.8-27b');
      const ok = await groq.healthCheck();
      groqLatency = Date.now() - t0;
      groqStatus = ok ? 'online' : 'degraded';
    } catch (e: any) {
      groqLatency = Date.now() - t0;
      groqStatus = 'offline';
      groqError = e.message || 'Connection failed';
    }
  }

  results.push({
    name: 'Groq Cloud',
    providerKey: 'groq',
    configured: hasGroqKey,
    status: groqStatus,
    latencyMs: groqLatency,
    activeModel: 'qwen/qwen3.8-27b',
    models: ['qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b'],
    contextWindow: '131,072 tokens',
    pricing: '$0.05 / 1M input',
    error: groqError || undefined,
  });

  // 3. OpenAI
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  let openaiStatus: 'online' | 'degraded' | 'offline' = 'offline';
  let openaiLatency = 0;
  let openaiError = '';
  if (hasOpenAIKey) {
    const t0 = Date.now();
    try {
      const openai = new OpenAIProvider('gpt-4o-mini');
      const ok = await openai.healthCheck();
      openaiLatency = Date.now() - t0;
      openaiStatus = ok ? 'online' : 'degraded';
    } catch (e: any) {
      openaiLatency = Date.now() - t0;
      openaiStatus = e.status === 429 || (e.message && e.message.includes('429')) ? 'degraded' : 'offline';
      openaiError = e.status === 429 ? 'Quota exhausted (fallback active)' : (e.message || 'Connection error');
    }
  }

  results.push({
    name: 'OpenAI',
    providerKey: 'openai',
    configured: hasOpenAIKey,
    status: openaiStatus,
    latencyMs: openaiLatency,
    activeModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'text-embedding-3-small'],
    contextWindow: '128,000 tokens',
    pricing: '$0.15 / 1M input',
    error: openaiError || undefined,
  });

  return results;
};
