export const estimateTokens = (text: string): number => {
  // Rough estimate: 1 token ≈ 4 characters in English
  const chars = text.length;
  return Math.ceil(chars / 4);
};
