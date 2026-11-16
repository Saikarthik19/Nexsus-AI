// Evaluation Service – implements the 10 Benchmark Evaluation Scenarios
import mongoose from 'mongoose';
import { Provider, LLMResponse } from './llm/llmTypes';
import GeminiProvider from './llm/geminiProvider';
import OpenAIProvider from './llm/thirdProvider';
import GroqProvider from './llm/groqProvider';
import { findModel } from './llm/providerRegistry';
import EvaluationResult from '../models/EvaluationResult';
import Document from '../models/Document'; // existing document model
import { z } from 'zod';
import { splitIntoChunks } from '../utils/chunkUtils';

// Helper to record a result
async function logResult(userId: string, scenarioId: number, passed: boolean, details: any, tokensUsed?: number, costUSD?: number) {
  const result = new EvaluationResult({
    userId,
    scenarioId,
    passed,
    details: JSON.stringify(details),
    tokensUsed,
    costUSD,
  });
  await result.save();
  return result;
}

/** Scenario 1 – Incomplete Input */
export async function scenario1(input: any, userId: string) {
  const required = ['name', 'email', 'age'];
  const missing = required.filter((f) => !(f in input));
  const details = missing.length ? { missingFields: missing } : { allFieldsPresent: true };
  const passed = missing.length > 0; // detection of missing fields is a pass
  return logResult(userId, 1, passed, details);
}

/** Scenario 2 – Contradictory Information */
export async function scenario2(input: any, userId: string) {
  const { birthYear, age } = input;
  let conflict = false;
  if (birthYear && age) {
    const currentYear = new Date().getFullYear();
    const expectedAge = currentYear - birthYear;
    conflict = Math.abs(expectedAge - age) > 1; // allow 1‑year drift
  }
  const details = conflict ? { conflict: true, birthYear, age } : { conflict: false };
  const passed = conflict; // detecting conflict is a pass
  return logResult(userId, 2, passed, details);
}

/** Scenario 3 – Hallucination detection */
export async function scenario3({ query, documentId }: { query: string; documentId: string }, userId: string) {
  const doc = await Document.findById(documentId).lean();
  const content = (doc as any)?.content || '';
  const modelInfo = findModel({});
  const provider = modelInfo.provider as Provider;
  const answerResp = await provider.generateResponse(query + '\n' + content);
  const answer = answerResp.content || '';
  const answerTokens = answer.toLowerCase().split(/\s+/).filter(Boolean);
  const contentTokens = content.toLowerCase().split(/\s+/);
  const overlap = answerTokens.filter((t) => contentTokens.includes(t)).length;
  const passed = overlap > 0;
  const details = { answer, overlapTokens: overlap };
  const tokensUsed = answerResp.inputTokens + answerResp.outputTokens;
  const costUSD = tokensUsed ? (tokensUsed / 1e6) * modelInfo.pricing.input : undefined;
  return logResult(userId, 3, passed, details, tokensUsed, costUSD);
}

/** Scenario 4 – Invalid JSON handling */
const JsonSchema = z.object({ answer: z.string(), score: z.number() });
const parseJsonSafely = (raw: string) => {
  const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
};
export async function scenario4(prompt: string, userId: string) {
  const provider = findModel({}).provider as Provider;
  const first = await provider.generateResponse(prompt);
  try {
    const parsed = JsonSchema.parse(parseJsonSafely(first.content || ''));
    const tokensUsed = first.inputTokens + first.outputTokens;
    return logResult(userId, 4, true, { parsed }, tokensUsed);
  } catch {
    const repairPrompt = `Please return valid JSON matching schema ${JSON.stringify(JsonSchema.shape)}. Previous output was malformed.`;
    const retry = await provider.generateResponse(repairPrompt);
    try {
      const parsed = JsonSchema.parse(parseJsonSafely(retry.content || ''));
      const tokensUsed = retry.inputTokens + retry.outputTokens;
      return logResult(userId, 4, true, { parsed }, tokensUsed);
    } catch (e2) {
      const tokensUsed = retry.inputTokens + retry.outputTokens;
      return logResult(userId, 4, false, { error: (e2 as Error).message }, tokensUsed);
    }
  }
}

/** Scenario 5 – Prompt injection detection */
export async function scenario5(prompt: string, userId: string) {
  const injectionPattern = /ignore\s+previous\s+instructions|you\s+are\s+now|execute\s+.*command|system:\\s*.*$/i;
  const detected = injectionPattern.test(prompt);
  const details = { detected };
  const passed = detected; // detection is a pass
  return logResult(userId, 5, passed, details);
}

/** Scenario 6 – Model disagreement */
export async function scenario6(query: string, userId: string) {
  const gemini = new GeminiProvider('gemini-3.5-flash-lite');
  const gResp = await gemini.generateResponse(query);

  let oResp: LLMResponse;
  try {
    const openai = new OpenAIProvider('gpt-4o-mini');
    oResp = await openai.generateResponse(query);
  } catch (err) {
    // Graceful fallback: If OpenAI is unavailable (e.g. 429 insufficient credits), compare against Groq
    const groq = new GroqProvider('openai/gpt-oss-20b');
    oResp = await groq.generateResponse(query);
  }

  const extractFact = (text: string) => {
    const num = text.match(/\d+/);
    if (num) return num[0];
    const entity = text.match(/\b([A-Z][a-z]+)\b/);
    return entity ? entity[1] : text.trim();
  };
  const factA = extractFact(gResp.content || '');
  const factB = extractFact(oResp.content || '');
  const passed = factA.toLowerCase() === factB.toLowerCase();
  const details = { factA, factB };
  const tokensUsed = (gResp.inputTokens + gResp.outputTokens) + (oResp.inputTokens + oResp.outputTokens);
  const costUSD = tokensUsed / 1e6 * 0.0002;
  return logResult(userId, 6, passed, details, tokensUsed, costUSD);
}

/** Scenario 7 – Provider failure fallback */
export async function scenario7(query: string, userId: string) {
  const faultyModel = 'nonexistent-model';
  // Step 1: Try to find the requested model
  const modelInfo = findModel({ forceModel: faultyModel });
  const requestedModelFound = modelInfo.modelName === faultyModel;

  if (!requestedModelFound) {
    // The requested model was not found – this is the "failure".
    // The gateway automatically fell back to the default model.
    const resp = await (modelInfo.provider as Provider).generateResponse(query);
    const passed = !!resp.content; // fallback produced a valid response
    const details = {
      requestedModel: faultyModel,
      requestedModelFound: false,
      fallbackModel: modelInfo.modelName,
      fallbackSuccess: passed,
    };
    const tokensUsed = resp.inputTokens + resp.outputTokens;
    const costUSD = tokensUsed ? (tokensUsed / 1e6) * modelInfo.pricing.input : undefined;
    return logResult(userId, 7, passed, details, tokensUsed, costUSD);
  }

  // If somehow the model was found, try calling it
  try {
    await (modelInfo.provider as Provider).generateResponse(query);
    return logResult(userId, 7, false, { error: 'Provider did not fail' });
  } catch (err) {
    const fallbackInfo = findModel({});
    const resp = await fallbackInfo.provider.generateResponse(query);
    const passed = !!resp.content;
    const details = { fallbackSuccess: passed, error: (err as Error).message };
    const tokensUsed = resp.inputTokens + resp.outputTokens;
    const costUSD = tokensUsed ? (tokensUsed / 1e6) * fallbackInfo.pricing.input : undefined;
    return logResult(userId, 7, passed, details, tokensUsed, costUSD);
  }
}

/** Scenario 8 – Long context handling */
export async function scenario8({ largeText }: { largeText: string }, userId: string) {
  const chunks = splitIntoChunks(largeText, 200);
  const modelInfo = findModel({});
  const retrieved = chunks[0] || '';
  const passed = chunks.length > 0 && retrieved.length > 0 && largeText.length < modelInfo.contextWindow;
  const details = { chunkCount: chunks.length, firstChunk: retrieved.slice(0, 30) + '...' };
  const tokensUsed = chunks.reduce((c, ch) => c + Math.ceil(ch.length / 4), 0);
  const costUSD = tokensUsed / 1e6 * modelInfo.pricing.input;
  return logResult(userId, 8, passed, details, tokensUsed, costUSD);
}

/** Scenario 9 – Cost management */
export async function scenario9({ query, budgetUSD }: { query: string; budgetUSD: number }, userId: string) {
  const modelInfo = findModel({});
  const provider = modelInfo.provider as Provider;
  const resp = await provider.generateResponse(query);
  const tokensUsed = resp.inputTokens + resp.outputTokens;
  const costUSD = (tokensUsed / 1e6) * (modelInfo.pricing.input + modelInfo.pricing.output);
  const passed = costUSD <= budgetUSD;
  const details = { costUSD, budgetUSD };
  return logResult(userId, 9, passed, details, tokensUsed, costUSD);
}

/** Scenario 10 – Business validation */
export async function scenario10({ invoice }: { invoice: { invoiceId: string; total: number; lineItems: any[] } }, userId: string) {
  const dup = await EvaluationResult.findOne({
    userId,
    scenarioId: 10,
    details: { $regex: invoice.invoiceId },
  }).lean();
  const isDuplicate = !!dup;
  const requiresHumanApproval = invoice.total > 10000;
  const passed = isDuplicate; // detecting duplicate is a pass
  const details = { isDuplicate, requiresHumanApproval };
  return logResult(userId, 10, passed, details);
}

// Export a dispatcher
export const runScenario = async (scenarioId: number, payload: any, userId: string) => {
  switch (scenarioId) {
    case 1:
      return scenario1(payload, userId);
    case 2:
      return scenario2(payload, userId);
    case 3:
      return scenario3(payload, userId);
    case 4:
      return scenario4(payload.prompt, userId);
    case 5:
      return scenario5(payload.prompt, userId);
    case 6:
      return scenario6(payload.query, userId);
    case 7:
      return scenario7(payload.query, userId);
    case 8:
      return scenario8(payload, userId);
    case 9:
      return scenario9(payload, userId);
    case 10:
      return scenario10(payload, userId);
    default:
      throw new Error('Invalid scenario');
  }
};
