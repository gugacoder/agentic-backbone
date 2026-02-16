import { query } from "@anthropic-ai/claude-agent-sdk";
import type { McpServerConfig } from "@anthropic-ai/claude-agent-sdk";
import { resolveModel, resolveEffort, resolveThinking } from "../../settings/llm.js";
import type { AgentEvent } from "../types.js";
import type { AgentProvider, AgentProviderOptions } from "./types.js";

// Allow nested Claude Code sessions (backbone runs as a service)
delete process.env.CLAUDECODE;

export function createClaudeProvider(): AgentProvider {
  return {
    async *run(
      prompt: string,
      options?: AgentProviderOptions
    ): AsyncGenerator<AgentEvent> {
      const role = options?.role ?? "conversation";
      const model = resolveModel(role);
      const effort = resolveEffort();
      const thinking = resolveThinking();

      console.log(`[claude] role=${role} model=${model} effort=${effort ?? "default"}`);

      // Build allowed tools list
      const allowedTools: string[] = ["Read", "Glob", "Grep", "Bash", "Write", "Edit"];
      const mcpServers = options?.mcpServers as
        | Record<string, McpServerConfig>
        | undefined;

      if (mcpServers) {
        for (const serverName of Object.keys(mcpServers)) {
          allowedTools.push(`mcp__${serverName}__*`);
        }
      }

      // MCP servers require streaming input mode (async generator)
      const promptInput: string | AsyncIterable<any> = mcpServers
        ? (async function* () {
            yield {
              type: "user" as const,
              message: { role: "user" as const, content: prompt },
              parent_tool_use_id: null,
              session_id: "",
            };
          })()
        : prompt;

      const stream = query({
        prompt: promptInput,
        options: {
          model,
          ...(effort ? { effort } : {}),
          ...(thinking ? { thinking } : {}),
          allowedTools,
          permissionMode: "bypassPermissions",
          ...(mcpServers ? { mcpServers } : {}),
          ...(options?.sdkSessionId ? { resume: options.sdkSessionId } : {}),
          stderr: (s: string) => {
            if (s.trim()) console.error("[claude:stderr]", s.trimEnd());
          },
        },
      });

      for await (const message of stream) {
        // Capture SDK session ID on init for resume
        if (
          (message as any).type === "system" &&
          (message as any).subtype === "init"
        ) {
          yield { type: "init", sessionId: (message as any).session_id };
        }

        // Stream text blocks from assistant messages
        if (
          (message as any).type === "assistant" &&
          Array.isArray((message as any).content)
        ) {
          for (const block of (message as any).content) {
            if (block.type === "text") {
              yield { type: "text", content: block.text };
            }
          }
        }

        // Final result + usage extraction
        if ("result" in (message as any)) {
          yield { type: "result", content: (message as any).result };

          const msg = message as any;
          const u = msg.usage ?? {};
          const mu = msg.modelUsage ?? {};
          yield {
            type: "usage",
            usage: {
              inputTokens: mu.inputTokens ?? u.input_tokens ?? 0,
              outputTokens: mu.outputTokens ?? u.output_tokens ?? 0,
              cacheReadInputTokens:
                mu.cacheReadInputTokens ?? u.cache_read_input_tokens ?? 0,
              cacheCreationInputTokens:
                mu.cacheCreationInputTokens ?? u.cache_creation_input_tokens ?? 0,
              totalCostUsd: msg.total_cost_usd ?? 0,
              numTurns: msg.num_turns ?? 0,
              durationMs: msg.duration_ms ?? 0,
              durationApiMs: msg.duration_api_ms ?? 0,
              stopReason: msg.stop_reason ?? "unknown",
            },
          };
        }
      }
    },
  };
}
