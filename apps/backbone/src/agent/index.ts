import { loadLlmConfig } from "../settings/llm.js";
import { createClaudeProvider } from "./providers/claude.js";
import { createAiProvider } from "./providers/ai.js";
import type { AgentEvent, UsageData } from "./types.js";

export type { AgentEvent, UsageData };

export async function* runAgent(
  prompt: string,
  options?: {
    sdkSessionId?: string;
    role?: string;
    mcpServers?: Record<string, unknown>;
    tools?: Record<string, any>;
  }
): AsyncGenerator<AgentEvent> {
  const config = loadLlmConfig();
  const provider =
    config.provider === "ai" ? createAiProvider() : createClaudeProvider();

  yield* provider.run(prompt, options);
}
