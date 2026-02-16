import { loadLlmConfig } from "../settings/llm.js";
import { createClaudeProvider } from "./providers/claude.js";
import { createKaiProvider } from "./providers/kai.js";
import type { AgentEvent, UsageData } from "./types.js";

export type { AgentEvent, UsageData };

export async function* runAgent(
  prompt: string,
  options?: {
    sdkSessionId?: string;
    role?: string;
    mcpServers?: Record<string, unknown>;
  }
): AsyncGenerator<AgentEvent> {
  const config = loadLlmConfig();
  const provider =
    config.provider === "kai" ? createKaiProvider() : createClaudeProvider();

  yield* provider.run(prompt, options);
}
