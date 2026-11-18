import OpenAI from 'openai';
import { LLMResponse, Provider, LLMStreamChunk } from './llmTypes';
import { estimateTokens } from '../../utils/tokenUtils';

export default class MistralProvider implements Provider {
  name = 'mistral';
  private client: OpenAI | null = null;
  public modelName: string;

  constructor(modelName = 'ministral-8b-latest') {
    const apiKey = process.env.MISTRAL_API_KEY || process.env.OPENAI_API_KEY;
    this.modelName = modelName;
    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        baseURL: 'https://api.mistral.ai/v1',
      });
    }
  }

  private ensureClient() {
    if (!this.client) {
      const key = process.env.MISTRAL_API_KEY || process.env.OPENAI_API_KEY;
      if (!key) throw new Error('MISTRAL_API_KEY not configured');
      this.client = new OpenAI({
        apiKey: key,
        baseURL: 'https://api.mistral.ai/v1',
      });
    }
  }

  async generateResponse(prompt: string): Promise<LLMResponse> {
    this.ensureClient();
    const completion = await this.client!.chat.completions.create({
      model: this.modelName,
      messages: [{ role: 'user', content: prompt }],
    });
    const content = completion.choices?.[0]?.message?.content ?? '';
    const inputTokens = completion.usage?.prompt_tokens ?? estimateTokens(prompt);
    const outputTokens = completion.usage?.completion_tokens ?? estimateTokens(content);
    
    // Mistral pricing approx: $0.10 per 1M input, $0.10 per 1M output
    const estimatedCost = (inputTokens * 0.10 + outputTokens * 0.10) / 1_000_000;

    return {
      content,
      model: this.modelName,
      inputTokens,
      outputTokens,
      estimatedCost,
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
      const res = await this.client!.models.list();
      return !!res.data && res.data.length > 0;
    } catch {
      return false;
    }
  }

  estimateTokens(text: string): number {
    return estimateTokens(text);
  }
}

// Export as OpenAIProvider for compatibility
export { MistralProvider as OpenAIProvider };
