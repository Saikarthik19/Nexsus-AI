export const estimateCost = (inputTokens: number, outputTokens: number, model: string): number => {
  // Pricing table (USD per 1M tokens) matching provider registry
  const pricing: { [key: string]: { input: number; output: number } } = {
    'gemini-3.5-flash-lite': { input: 0.075, output: 0.30 },
    'gemini': { input: 0.075, output: 0.30 },
    'qwen/qwen3.8-27b': { input: 0.05, output: 0.08 },
    'openai/gpt-oss-20b': { input: 0.05, output: 0.08 },
    'groq': { input: 0.05, output: 0.08 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'openai': { input: 0.15, output: 0.60 },
  };
  const p = pricing[model] || pricing['gemini'];
  const cost = (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
  return Number(cost.toFixed(6));
};
