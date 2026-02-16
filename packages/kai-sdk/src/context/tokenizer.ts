import { encodingForModel } from "js-tiktoken";

const encoder = encodingForModel("gpt-4o");

/**
 * Returns an estimated token count for the given text using cl100k_base encoding.
 * Returns 0 for empty strings.
 */
export function countTokens(text: string): number {
  if (!text) return 0;
  return encoder.encode(text).length;
}
