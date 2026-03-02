import { runAgent as runProxyAgent, type AgentEvent, type UsageData } from "@agentic-backbone/ai-sdk";
import { loadLlmConfig, resolveModel, resolveEffort, resolveThinking } from "../settings/llm.js";
import { join } from "node:path";

export type { AgentEvent, UsageData };

export async function* runAgent(
  prompt: string,
  options?: {
    sessionId?: string;
    role?: string;
    tools?: Record<string, any>;
  }
): AsyncGenerator<AgentEvent> {
  const config = loadLlmConfig();
  const role = options?.role ?? "conversation";
  const model = resolveModel(role);
  const effort = resolveEffort();
  const thinking = resolveThinking();

  const apiKey = config.provider === "claude"
    ? process.env.ANTHROPIC_API_KEY!
    : process.env.OPENROUTER_API_KEY!;

  yield* runProxyAgent({
    provider: config.provider,
    model,
    apiKey,
    prompt,
    sessionId: options?.sessionId,
    sessionDir: join(process.cwd(), "data", "ai-sessions"),
    role,
    tools: options?.tools,
    maxTurns: 30,
    providerConfig: {
      ...(effort ? { effort } : {}),
      ...(thinking ? { thinking } : {}),
    },
  });
}
