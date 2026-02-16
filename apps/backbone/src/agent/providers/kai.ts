import { runKaiAgent, type McpServerConfig } from "@agentic-backbone/kai-sdk";
import { resolveModel } from "../../settings/llm.js";
import type { AgentEvent } from "../types.js";
import type { AgentProvider, AgentProviderOptions } from "./types.js";
import { join } from "node:path";

/**
 * Convert Backbone's Record<string, unknown> MCP server format to KAI SDK's McpServerConfig[].
 * Only entries with a valid `transport` field (http or stdio) are included.
 * In-process SDK MCP servers (no transport) are silently skipped.
 */
function toMcpServerConfigs(
  servers: Record<string, unknown>
): McpServerConfig[] {
  const configs: McpServerConfig[] = [];
  for (const [name, value] of Object.entries(servers)) {
    if (!value || typeof value !== "object") continue;
    const entry = value as Record<string, any>;
    if (!entry.transport || typeof entry.transport !== "object") continue;
    const t = entry.transport;
    if (t.type === "http" && typeof t.url === "string") {
      configs.push({
        name,
        transport: { type: "http", url: t.url, headers: t.headers },
      });
    } else if (t.type === "stdio" && typeof t.command === "string") {
      configs.push({
        name,
        transport: { type: "stdio", command: t.command, args: t.args },
      });
    }
  }
  return configs;
}

export function createKaiProvider(): AgentProvider {
  return {
    async *run(
      prompt: string,
      options?: AgentProviderOptions
    ): AsyncGenerator<AgentEvent> {
      const role = options?.role ?? "conversation";
      const model = resolveModel(role);
      const apiKey = process.env.OPENROUTER_API_KEY;

      if (!apiKey) {
        throw new Error("OPENROUTER_API_KEY is required for the Kai provider");
      }

      console.log(`[kai] role=${role} model=${model}`);

      const sessionDir = join(process.cwd(), "data", "kai-sessions");

      const mcpConfigs = options?.mcpServers
        ? toMcpServerConfigs(options.mcpServers)
        : [];

      try {
        for await (const event of runKaiAgent(prompt, {
          model,
          apiKey,
          sessionId: options?.sdkSessionId,
          sessionDir,
          maxSteps: options?.maxTurns ?? 30,
          ...(mcpConfigs.length > 0 ? { mcpServers: mcpConfigs } : {}),
        })) {
          // KaiAgentEvent maps 1:1 to AgentEvent
          yield event as AgentEvent;
        }
      } catch (err) {
        const base = err instanceof Error ? err.message : String(err);
        const enriched = new Error(`[kai] ${base}`);
        if (err instanceof Error) enriched.stack = err.stack;
        throw enriched;
      }
    },
  };
}
