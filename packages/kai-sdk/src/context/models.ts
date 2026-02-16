const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  // Anthropic — Claude 4.x
  "anthropic/claude-opus-4-6": 200000,
  "anthropic/claude-sonnet-4-5": 200000,
  "anthropic/claude-haiku-4-5": 200000,
  // Anthropic — Claude 3.x
  "anthropic/claude-3.5-sonnet": 200000,
  "anthropic/claude-3.5-haiku": 200000,
  "anthropic/claude-3-opus": 200000,
  "anthropic/claude-3-sonnet": 200000,
  "anthropic/claude-3-haiku": 200000,
  // OpenAI
  "openai/gpt-4o": 128000,
  "openai/gpt-4o-mini": 128000,
  "openai/gpt-4-turbo": 128000,
  "openai/o1": 200000,
  "openai/o1-mini": 128000,
  "openai/o3": 200000,
  "openai/o3-mini": 200000,
  "openai/o4-mini": 200000,
  // Google
  "google/gemini-2.0-flash": 1048576,
  "google/gemini-2.5-pro": 1048576,
  // Meta
  "meta-llama/llama-3.1-405b-instruct": 131072,
  "meta-llama/llama-3.1-70b-instruct": 131072,
  // DeepSeek
  "deepseek/deepseek-chat-v3": 131072,
  "deepseek/deepseek-r1": 131072,
};

const DEFAULT_CONTEXT_WINDOW = 128000;

/**
 * Returns the context window size for a model ID.
 * If `override` is provided, it takes precedence over the map.
 * Unknown models default to 128000.
 */
export function getContextWindow(modelId: string, override?: number): number {
  if (override !== undefined) return override;
  return MODEL_CONTEXT_WINDOWS[modelId] ?? DEFAULT_CONTEXT_WINDOW;
}
