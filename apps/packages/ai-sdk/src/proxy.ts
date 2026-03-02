import { AgentRunOptionsSchema, type AgentEvent } from "./schemas.js";
import type { ProxyAdapter } from "./adapters/types.js";
import { createAiAdapter } from "./adapters/ai.js";
import { createClaudeAdapter } from "./adapters/claude.js";

const adapters: Record<string, () => ProxyAdapter> = {
  ai: () => createAiAdapter(),
  claude: () => createClaudeAdapter(),
};

export async function* runAgent(
  raw: unknown
): AsyncGenerator<AgentEvent> {
  const options = AgentRunOptionsSchema.parse(raw);
  const factory = adapters[options.provider];
  if (!factory) throw new Error(`Unknown provider: ${options.provider}`);
  yield* factory().run(options);
}
