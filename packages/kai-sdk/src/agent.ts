import { streamText, type CoreMessage } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport as StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
import { codingTools } from "./tools/index.js";
import { createAskUserTool } from "./tools/ask-user.js";
import { createWebSearchTool } from "./tools/web-search.js";
import { createTaskTool } from "./tools/task.js";
import { createBatchTool } from "./tools/batch.js";
import { createCodeSearchTool } from "./tools/code-search.js";
import { loadSession, saveSession } from "./session.js";
import { getSystemPrompt, discoverProjectContext } from "./prompts/assembly.js";
import { getContextUsage } from "./context/usage.js";
import { compactMessages } from "./context/compaction.js";
import type { KaiAgentEvent, KaiAgentOptions, McpServerConfig } from "./types.js";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

const DEFAULT_SESSION_DIR = join(process.cwd(), "data", "kai-sessions");
const DEFAULT_MAX_STEPS = 30;

function createMcpTransport(config: McpServerConfig) {
  if (config.transport.type === "stdio") {
    return new StdioMCPTransport({
      command: config.transport.command,
      args: config.transport.args,
    });
  }
  // http transport — passed directly to createMCPClient
  return {
    type: config.transport.type as "http",
    url: config.transport.url,
    headers: config.transport.headers,
  };
}

export async function* runKaiAgent(
  prompt: string,
  options: KaiAgentOptions
): AsyncGenerator<KaiAgentEvent> {
  const openrouter = createOpenAICompatible({
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: options.apiKey,
  });

  const sessionDir = options.sessionDir ?? DEFAULT_SESSION_DIR;
  const sessionId = options.sessionId ?? randomUUID();

  // Session resume: load history if sessionId was provided
  let previousMessages: CoreMessage[] = [];
  if (options.sessionId) {
    previousMessages = await loadSession(sessionDir, options.sessionId);
  }

  const startMs = Date.now();
  const messages: CoreMessage[] = [
    ...previousMessages,
    { role: "user", content: prompt },
  ];

  yield { type: "init", sessionId };

  // MCP client lifecycle: create clients, collect tools, close on exit
  const mcpClients: MCPClient[] = [];

  try {
    // Connect to MCP servers and collect their tools
    let mcpTools: Record<string, any> = {};
    if (options.mcpServers && options.mcpServers.length > 0) {
      const connectedServers: string[] = [];
      for (const serverConfig of options.mcpServers) {
        try {
          const transport = createMcpTransport(serverConfig);
          const client = await createMCPClient({
            transport,
            name: serverConfig.name,
          });
          mcpClients.push(client);
          const serverTools = await client.tools();
          mcpTools = { ...mcpTools, ...serverTools };
          connectedServers.push(serverConfig.name);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[kai] MCP server "${serverConfig.name}" failed to connect: ${msg}`);
        }
      }
      yield { type: "mcp_connected", servers: connectedServers };
    }

    // Override pluggable tools with configured callbacks if provided
    // codingTools have priority over MCP tools (spread order: MCP first, coding on top)
    let tools = { ...mcpTools, ...codingTools };
    if (options.onAskUser) {
      tools = { ...tools, AskUser: createAskUserTool(options.onAskUser) };
    }
    if (options.onWebSearch) {
      tools = { ...tools, WebSearch: createWebSearchTool(options.onWebSearch) };
    }
    if (options.onCodeSearch) {
      tools = { ...tools, CodeSearch: createCodeSearchTool(options.onCodeSearch) };
    }

    // Always override Task tool with parent's config so sub-agents inherit model/apiKey
    tools = {
      ...tools,
      Task: createTaskTool({
        model: options.model,
        apiKey: options.apiKey,
        maxSubSteps: Math.min(options.maxSteps ?? DEFAULT_MAX_STEPS, 10),
      }),
    };

    // Override Batch tool with the fully resolved tool registry
    tools = {
      ...tools,
      Batch: createBatchTool(tools),
    };

    // Build system prompt based on 3 modes:
    // 1. undefined  → auto: base prompt (filtered by active tools) + project context
    // 2. { append } → base prompt + project context + consumer's append text
    // 3. string     → override: consumer's string only, no base, no discovery
    let systemPrompt: string | undefined;

    if (typeof options.system === "string") {
      // Mode 3: full override — consumer replaces everything
      systemPrompt = options.system;
    } else {
      // Mode 1 or 2: build base prompt from active tools
      const activeTools = Object.keys(tools);
      const base = getSystemPrompt(activeTools);

      // Discover project context once (AGENTS.md / CLAUDE.md walk-up)
      const cwd = options.cwd ?? process.cwd();
      const projectContext = await discoverProjectContext(cwd);

      const parts = [base];
      if (projectContext) {
        parts.push(projectContext);
      }

      // Mode 2: append consumer text after base + context
      if (options.system && typeof options.system === "object" && "append" in options.system) {
        parts.push(options.system.append);
      }

      systemPrompt = parts.join("\n\n");
    }

    // --- Context management: usage calculation + compaction ---
    const toolDefinitions = tools as Record<string, unknown>;
    let compacted = false;

    // Calculate context usage before potential compaction
    let ctxUsage = getContextUsage({
      model: options.model,
      systemPrompt: systemPrompt ?? "",
      toolDefinitions,
      messages,
      contextWindow: options.contextWindow,
      compactThreshold: options.compactThreshold,
    });

    // Compact if threshold exceeded and compaction is enabled
    if (ctxUsage.willCompact && !options.disableCompaction) {
      const compactResult = await compactMessages(messages, {
        model: options.model,
        apiKey: options.apiKey,
        contextWindow: options.contextWindow,
        systemPromptTokens: ctxUsage.systemPrompt,
        toolDefinitionsTokens: ctxUsage.toolDefinitions,
      });

      if (compactResult.compacted) {
        messages.length = 0;
        messages.push(...compactResult.messages);
        compacted = true;

        // Recalculate usage after compaction
        ctxUsage = getContextUsage({
          model: options.model,
          systemPrompt: systemPrompt ?? "",
          toolDefinitions,
          messages,
          contextWindow: options.contextWindow,
          compactThreshold: options.compactThreshold,
        });
      }

      if (compactResult.warning) {
        console.warn(`[kai] ${compactResult.warning}`);
      }
    }

    // Emit context_status event before calling streamText
    yield {
      type: "context_status",
      context: { ...ctxUsage, compacted },
    };

    // Step event tracking — onStepFinish pushes events, fullStream loop yields them
    const pendingStepEvents: KaiAgentEvent[] = [];
    let stepCounter = 0;

    let result;
    try {
      result = streamText({
        model: openrouter(options.model),
        tools,
        maxSteps: options.maxSteps ?? DEFAULT_MAX_STEPS,
        messages,
        system: systemPrompt,
        onStepFinish: (stepResult) => {
          const toolNames = (stepResult.toolCalls ?? []).map(
            (tc: { toolName: string }) => tc.toolName
          );
          pendingStepEvents.push({
            type: "step_finish",
            step: stepCounter,
            toolCalls: toolNames,
            finishReason: stepResult.finishReason ?? "unknown",
          });
          stepCounter++;
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`OpenRouter request failed: ${msg}`);
    }

    // Stream text deltas — surface API errors instead of hanging
    let fullText = "";
    try {
      for await (const part of result.fullStream) {
        if (part.type === "text-delta") {
          fullText += part.textDelta;
          yield { type: "text", content: part.textDelta };
        } else if (part.type === "step-finish") {
          // Drain pending step_finish events collected by onStepFinish
          while (pendingStepEvents.length > 0) {
            yield pendingStepEvents.shift()!;
          }
        } else if (part.type === "error") {
          const errMsg = (part as any).error?.message ?? JSON.stringify((part as any).error ?? part);
          throw new Error(`OpenRouter API error: ${errMsg}`);
        }
      }
    } catch (err) {
      // Re-throw with context if it's not already our error
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.startsWith("OpenRouter")) {
        throw new Error(`OpenRouter stream error: ${msg}`);
      }
      throw err;
    }

    // Drain any remaining step events not yet emitted (edge case: stream ends without step-finish)
    while (pendingStepEvents.length > 0) {
      yield pendingStepEvents.shift()!;
    }

    // Persist session
    const response = await result.response;
    await saveSession(sessionDir, sessionId, [
      ...messages,
      ...response.messages as CoreMessage[],
    ]);

    // Final result + usage
    const usage = await result.usage;
    const steps = await result.steps;
    const finishReason = await result.finishReason;

    // Fetch cost from OpenRouter generation endpoint
    let totalCostUsd = 0;
    try {
      const genId = (await result.response).id;
      if (genId) {
        // Small delay — OpenRouter may not have the generation ready immediately
        await new Promise((r) => setTimeout(r, 500));
        const res = await fetch(`https://openrouter.ai/api/v1/generation?id=${genId}`, {
          headers: { Authorization: `Bearer ${options.apiKey}` },
        });
        if (res.ok) {
          const gen = (await res.json()) as { data?: { total_cost?: number } };
          totalCostUsd = gen.data?.total_cost ?? 0;
        }
      }
    } catch {
      // Non-critical — cost stays 0
    }

    yield { type: "result", content: fullText };
    yield {
      type: "usage",
      usage: {
        inputTokens: usage.promptTokens ?? 0,
        outputTokens: usage.completionTokens ?? 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
        totalCostUsd,
        numTurns: steps.length,
        durationMs: Date.now() - startMs,
        durationApiMs: 0,
        stopReason: finishReason ?? "unknown",
      },
    };
  } finally {
    // Close all MCP clients to avoid leaked connections/processes
    for (const client of mcpClients) {
      await client.close().catch(() => {});
    }
  }
}
