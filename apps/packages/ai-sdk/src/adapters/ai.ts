import { runAiAgent } from "../agent.js";
import type { AgentEvent, AgentRunOptions } from "../schemas.js";
import type { ProxyAdapter } from "./types.js";

export function createAiAdapter(): ProxyAdapter {
  return {
    async *run(options: AgentRunOptions): AsyncGenerator<AgentEvent> {
      const startMs = Date.now();

      console.log(`[proxy:ai] model=${options.model} role=${options.role ?? "conversation"}`);

      for await (const event of runAiAgent(options.prompt, {
        model: options.model,
        apiKey: options.apiKey,
        sessionId: options.sessionId,
        sessionDir: options.sessionDir,
        maxSteps: options.maxTurns ?? 30,
        ...(options.tools ? { tools: options.tools } : {}),
      })) {
        // Map AiAgentEvent → AgentEvent (4 base types only)
        if (event.type === "init") {
          yield { type: "init", sessionId: event.sessionId };
        } else if (event.type === "text") {
          yield { type: "text", content: event.content };
        } else if (event.type === "result") {
          yield { type: "result", content: event.content };
        } else if (event.type === "usage") {
          yield {
            type: "usage",
            usage: {
              inputTokens: event.usage.inputTokens,
              outputTokens: event.usage.outputTokens,
              cacheReadInputTokens: event.usage.cacheReadInputTokens,
              cacheCreationInputTokens: event.usage.cacheCreationInputTokens,
              totalCostUsd: event.usage.totalCostUsd,
              numTurns: event.usage.numTurns,
              durationMs: event.usage.durationMs || (Date.now() - startMs),
              durationApiMs: event.usage.durationApiMs,
              stopReason: event.usage.stopReason,
            },
          };
        }
        // Other event types (mcp_connected, step_finish, etc.) are silently dropped
      }
    },
  };
}
