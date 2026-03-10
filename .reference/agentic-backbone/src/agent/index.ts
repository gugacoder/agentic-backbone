import { loadLlmConfig } from "../settings/llm.js";
import { createClaudeProvider } from "./providers/claude.js";
import { createKaiProvider } from "./providers/kai.js";
import type { AgentEvent, UsageData } from "./types.js";
import type { AgentProviderOptions } from "./providers/types.js";

export type { AgentEvent, UsageData };
export type { ToolDefinition } from "./tool-defs.js";
export { createAllTools } from "./create-all-tools.js";

export async function* runAgent(
  prompt: string,
  options?: AgentProviderOptions
): AsyncGenerator<AgentEvent> {
  const config = loadLlmConfig();
  const provider =
    config.provider === "kai" ? createKaiProvider() : createClaudeProvider();

  yield* provider.run(prompt, options);
}
