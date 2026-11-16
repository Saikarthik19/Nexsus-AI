export const getDevResponse = async (userMessage: string): Promise<{content: string; model: string; inputTokens: number; outputTokens: number; estimatedCost: number;}> => {
  // Simple deterministic response for development.
  const response = `You said: "${userMessage}"`;
  const inputTokens = Math.ceil(userMessage.length / 4);
  const outputTokens = Math.ceil(response.length / 4);
  const model = 'dev-model';
  // Use cost estimator utility if needed.
  const estimatedCost = 0; // free dev model
  // Simulate async latency.
  await new Promise((resolve) => setTimeout(resolve, 500));
  return { content: response, model, inputTokens, outputTokens, estimatedCost };
};
