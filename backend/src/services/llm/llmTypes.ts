export interface LLMResponse {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}

export interface LLMStreamChunk {
  content: string; // incremental text
  done: boolean; // whether the stream is finished
}

export interface Provider {
  name: string; // e.g., 'gemini', 'groq', 'openai'
  generateResponse(prompt: string): Promise<LLMResponse>;
  streamResponse(prompt: string): AsyncIterable<LLMStreamChunk>;
  generateStructuredResponse?<T>(prompt: string, schema: any): Promise<T>;
  estimateTokens(text: string): number;
  healthCheck(): Promise<boolean>;
}
