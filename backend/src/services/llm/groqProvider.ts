import Groq from 'groq-sdk';
import { LLMResponse, Provider, LLMStreamChunk } from './llmTypes';
import { estimateTokens } from '../../utils/tokenUtils';

export default class GroqProvider implements Provider {
  name = 'groq';
  private client: Groq | null = null;
  public modelName: string;

  constructor(modelName = 'qwen/qwen3.8-27b') {
    const apiKey = process.env.GROQ_API_KEY;
    this.modelName = modelName;
    if (apiKey) {
      this.client = new Groq({ apiKey });
    }
  }

  private ensureClient() {
    if (!this.client) {
      const key = process.env.GROQ_API_KEY;
      if (!key) throw new Error('GROQ_API_KEY not set');
      this.client = new Groq({ apiKey: key });
    }
  }

  async generateResponse(prompt: string): Promise<LLMResponse> {
    this.ensureClient();
    const chat = await this.client!.chat.completions.create({
      model: this.modelName,
      messages: [{ role: 'user', content: prompt }],
    });
    const content = chat.choices?.[0]?.message?.content ?? '';
    const inputTokens = chat.usage?.prompt_tokens ?? estimateTokens(prompt);
    const outputTokens = chat.usage?.completion_tokens ?? estimateTokens(content);
    return {
      content,
      model: this.modelName,
      inputTokens,
      outputTokens,
      estimatedCost: 0,
    };
  }

  async *streamResponse(prompt: string): AsyncIterable<LLMStreamChunk> {
    this.ensureClient();
    const stream = await this.client!.chat.completions.create({
      model: this.modelName,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    });
    let buffer = '';
    for await (const part of stream) {
      const delta = part.choices?.[0]?.delta?.content ?? '';
      buffer += delta;
      yield { content: buffer, done: false };
    }
    yield { content: buffer, done: true };
  }

  async healthCheck(): Promise<boolean> {
    try {
      this.ensureClient();
      await this.client!.models.list();
      return true;
    } catch {
      return false;
    }
  }

  estimateTokens(text: string): number {
    return estimateTokens(text);
  }
}
