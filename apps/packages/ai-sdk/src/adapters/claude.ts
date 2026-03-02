import type { AgentEvent, AgentRunOptions } from "../schemas.js";
import type { ProxyAdapter } from "./types.js";

// Allow nested Claude Code sessions (backbone runs as a service)
delete process.env.CLAUDECODE;

/**
 * Lazy-load the Claude Agent SDK at runtime.
 * Uses a variable to prevent TypeScript from resolving the module types at compile time
 * (the SDK type graph is extremely heavy and causes OOM during compilation).
 */
const CLAUDE_SDK_MODULE = "@anthropic-ai/claude-agent-sdk";
async function loadClaudeSdk(): Promise<any> {
  return import(/* webpackIgnore: true */ CLAUDE_SDK_MODULE);
}

/**
 * Convert Vercel AI SDK tools (Record<string, ToolDef>) to a Claude SDK MCP server.
 * Each Vercel tool has: { description, parameters (zod schema), execute }
 */
async function toolsToMcpServer(
  tools: Record<string, any>
): Promise<{ mcpServer: unknown; serverName: string }> {
  const sdk = await loadClaudeSdk();
  const { createSdkMcpServer, tool: sdkTool } = sdk;

  const serverName = "proxy-tools";
  const mcpTools: any[] = [];

  for (const [name, t] of Object.entries(tools)) {
    if (!t || typeof t !== "object") continue;
    const description = t.description ?? `Tool: ${name}`;
    const parameters = t.parameters ?? {};
    const execute = t.execute;

    mcpTools.push(
      sdkTool(
        name,
        description,
        parameters,
        async (args: any) => {
          if (typeof execute !== "function") {
            return {
              content: [{ type: "text" as const, text: `Tool ${name} has no execute function` }],
            };
          }
          try {
            const result = await execute(args);
            const text = typeof result === "string" ? result : JSON.stringify(result);
            return { content: [{ type: "text" as const, text }] };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { content: [{ type: "text" as const, text: `Error: ${msg}` }] };
          }
        }
      )
    );
  }

  return {
    serverName,
    mcpServer: createSdkMcpServer({
      name: serverName,
      version: "1.0.0",
      tools: mcpTools,
    }),
  };
}

export function createClaudeAdapter(): ProxyAdapter {
  return {
    async *run(options: AgentRunOptions): AsyncGenerator<AgentEvent> {
      const sdk = await loadClaudeSdk();
      const { query } = sdk;

      const effort = options.providerConfig?.effort as string | undefined;
      const thinking = options.providerConfig?.thinking as
        | { type: "adaptive" }
        | { type: "enabled"; budgetTokens: number }
        | { type: "disabled" }
        | undefined;

      console.log(
        `[proxy:claude] model=${options.model} role=${options.role ?? "conversation"} effort=${effort ?? "default"}`
      );

      // Build allowed tools list
      const allowedTools: string[] = ["Read", "Glob", "Grep", "Bash", "Write", "Edit"];

      // Convert Vercel AI SDK tools to MCP server if provided
      let mcpServers: Record<string, unknown> | undefined;
      if (options.tools && Object.keys(options.tools).length > 0) {
        const { mcpServer, serverName } = await toolsToMcpServer(options.tools);
        mcpServers = { [serverName]: mcpServer };
        allowedTools.push(`mcp__${serverName}__*`);
      }

      // MCP servers require streaming input mode (async generator)
      const promptInput: string | AsyncIterable<any> = mcpServers
        ? (async function* () {
            yield {
              type: "user" as const,
              message: { role: "user" as const, content: options.prompt },
              parent_tool_use_id: null,
              session_id: "",
            };
          })()
        : options.prompt;

      const stream = query({
        prompt: promptInput,
        options: {
          model: options.model,
          ...(effort ? { effort } : {}),
          ...(thinking ? { thinking } : {}),
          allowedTools,
          permissionMode: "bypassPermissions",
          ...(mcpServers ? { mcpServers } : {}),
          ...(options.sessionId ? { resume: options.sessionId } : {}),
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
