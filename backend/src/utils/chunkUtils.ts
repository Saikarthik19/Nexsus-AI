// Simple utility to split a string into chunks of a given size (character length).
// In a real implementation you would use token‑based splitting, but for the
// purposes of evaluation scenarios a character‑based splitter is
// sufficient.

/**
 * Split `text` into an array of substrings each of maximum `size` characters.
 * The last chunk may be shorter.
 */
export function splitIntoChunks(text: string, size: number): string[] {
  if (size <= 0) return [text];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}
