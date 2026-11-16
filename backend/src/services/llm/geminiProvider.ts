import { GoogleGenerativeAI } from '@google/generative-ai';
import { LLMResponse, Provider, LLMStreamChunk } from './llmTypes';
import { estimateTokens } from '../../utils/tokenUtils';

export default class GeminiProvider implements Provider {
  name = 'gemini';
  private client: GoogleGenerativeAI | null = null;
  public modelName: string;

  constructor(modelName = 'gemini-3.5-flash-lite') {
    const apiKey = process.env.GEMINI_API_KEY;
    this.modelName = modelName;
    if (apiKey) {
      this.client = new GoogleGenerativeAI(apiKey);
    }
  }

  private ensureClient() {
    if (!this.client) {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new Error('GEMINI_API_KEY not set');
      this.client = new GoogleGenerativeAI(key);
    }
  }

  async generateResponse(prompt: string): Promise<LLMResponse> {
    this.ensureClient();
    const model = this.client!.getGenerativeModel({ model: this.modelName });
    const result = await model.generateContent(prompt);
    let content = '';
    try {
      content = result.response.text();
    } catch {
      content = result.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    }
    const inputTokens = estimateTokens(prompt);
    const outputTokens = estimateTokens(content);
    return {
      content,
      model: this.modelName,
      inputTokens,
      outputTokens,
      estimatedCost: 0,
    };
  }

  async *streamResponse(prompt: string): AsyncIterable<LLMStreamChunk> {
    const resp = await this.generateResponse(prompt);
    yield { content: resp.content, done: true };
  }

  async healthCheck(): Promise<boolean> {
    try {
      this.ensureClient();
      const model = this.client!.getGenerativeModel({ model: this.modelName });
      const test = await model.generateContent('ping');
      return !!test.response;
    } catch {
      return false;
    }
  }

  estimateTokens(text: string): number {
    return estimateTokens(text);
  }
}
