import { streamText, wrapLanguageModel, type CoreMessage, type TelemetrySettings } from "ai";
import { createAiProviderRegistry } from "./providers.js";
import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport as StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
import { codingTools } from "./tools/index.js";
import { createBashTool } from "./tools/bash.js";
import { createWriteTool } from "./tools/write.js";
import { createEditTool } from "./tools/edit.js";
import { createMultiEditTool } from "./tools/multi-edit.js";
import { createApplyPatchTool } from "./tools/apply-patch.js";
import { createAskUserTool } from "./tools/ask-user.js";
import { createWebSearchTool } from "./tools/web-search.js";
import { createTaskTool } from "./tools/task.js";
import { createBatchTool } from "./tools/batch.js";
import { createCodeSearchTool } from "./tools/code-search.js";
import { loadSession, saveSession } from "./session.js";
import { getSystemPrompt, discoverProjectContext } from "./prompts/assembly.js";
import { getContextUsage } from "./context/usage.js";
import { compactMessages } from "./context/compaction.js";
import { createToolCallRepairHandler } from "./tool-repair.js";
import type { AiAgentEvent, AiAgentOptions, McpServerConfig, PrepareStepResult, ToolApprovalRequest } from "./types.js";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

const DEFAULT_SESSION_DIR = join(process.cwd(), "data", "ai-sessions");
const DEFAULT_MAX_STEPS = 30;

/**
 * Attempt to create an OTel span for the agent run.
 * Uses dynamic import so the build doesn't break when @opentelemetry/api isn't installed.
 * Returns a Span-like object with .end(), or undefined when unavailable/disabled.
 */
async function tryStartSessionSpan(
  options: AiAgentOptions,
  sessionId: string
): Promise<{ end: () => void } | undefined> {
  if (!options.telemetry?.enabled) return undefined;

  try {
    const otel = await import("@opentelemetry/api");
    const tracer = otel.trace.getTracer("ai-sdk");
    return tracer.startSpan("ai.agent.run", {
      attributes: {
        "ai.session_id": sessionId,
        "ai.model": options.model,
        "ai.max_steps": options.maxSteps ?? DEFAULT_MAX_STEPS,
      },
    });
  } catch {
    console.warn(
      "[ai] telemetry.enabled is true but @opentelemetry/api is not installed. " +
        "Install it as a dependency to enable custom spans. Continuing without session span."
    );
    return undefined;
  }
}

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

export async function* runAiAgent(
  prompt: string,
  options: AiAgentOptions
): AsyncGenerator<AiAgentEvent> {
  const providers = createAiProviderRegistry({
    apiKey: options.apiKey,
    aliases: options.modelAliases,
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

  // Session-level OTel span (F-006): wraps the entire agent run
  const sessionSpan = await tryStartSessionSpan(options, sessionId);

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
          console.warn(`[ai] MCP server "${serverConfig.name}" failed to connect: ${msg}`);
        }
      }
      yield { type: "mcp_connected", servers: connectedServers };
    }

    // Override pluggable tools with configured callbacks if provided
    // codingTools have priority over MCP tools (spread order: MCP first, coding on top)
    const autoApprove = options.autoApprove ?? true;
    const dangerousTools = {
      Bash: createBashTool({ autoApprove }),
      Write: createWriteTool({ autoApprove }),
      Edit: createEditTool({ autoApprove }),
      MultiEdit: createMultiEditTool({ autoApprove }),
      ApplyPatch: createApplyPatchTool({ autoApprove }),
    };
    let tools = { ...mcpTools, ...codingTools, ...dangerousTools };
    if (options.tools) {
      tools = { ...tools, ...options.tools };
    }
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
        middleware: options.middleware,
        telemetry: options.telemetry,
        providers,
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
        console.warn(`[ai] ${compactResult.warning}`);
      }
    }

    // Emit context_status event before calling streamText
    yield {
      type: "context_status",
      context: { ...ctxUsage, compacted },
    };

    // Step event tracking — onStepFinish pushes events, fullStream loop yields them
    const pendingStepEvents: AiAgentEvent[] = [];
    let stepCounter = 0;
    let previousToolCalls: string[] = [];

    // Step data collection for telemetry (F-007)
    const telemetryEnabled = options.telemetry?.enabled === true;
    const collectedSteps: Array<{
      stepNumber: number;
      toolCalls: string[];
      inputTokens: number;
      outputTokens: number;
      durationMs: number;
    }> = [];
    let stepStartMs = Date.now();

    // Tool approval wrapping (F-008): when autoApprove is false, wrap dangerous tools'
    // execute functions to intercept calls and invoke the onToolApproval callback.
    // ai@4.3.19 doesn't natively support needsApproval, so we implement it at this layer.
    if (!autoApprove) {
      const dangerousToolNames = ["Bash", "Write", "Edit", "MultiEdit", "ApplyPatch"];
      const toolsRecord = tools as Record<string, any>;
      for (const toolName of dangerousToolNames) {
        const t = toolsRecord[toolName];
        if (!t || !t.execute) continue;

        const originalExecute = t.execute;
        t.execute = async (args: Record<string, unknown>, execOpts: any) => {
          const request: ToolApprovalRequest = { toolName, params: args };
          let approved: boolean;

          if (options.onToolApproval) {
            approved = await options.onToolApproval(request);
          } else {
            console.warn(
              `[ai] autoApprove is false but no onToolApproval callback provided. Auto-approving ${toolName}.`
            );
            approved = true;
          }

          pendingStepEvents.push({
            type: "tool_approval",
            toolName,
            params: args,
            approved,
          });

          if (!approved) {
            return `Tool call rejected: ${toolName} was not approved by the user.`;
          }

          return originalExecute(args, execOpts);
        };
      }
    }

    // Tool repair integration (F-004): wrap createToolCallRepairHandler to emit events + track count
    const repairEnabled = options.repairToolCalls !== false;
    let repairedToolCallsCount = 0;

    const experimentalRepairToolCall = repairEnabled
      ? (() => {
          const baseModel = providers.model(options.model);
          const handler = createToolCallRepairHandler({
            model: baseModel,
            maxAttempts: options.maxRepairAttempts ?? 1,
          });

          return async (params: {
            system: string | undefined;
            messages: CoreMessage[];
            toolCall: { toolCallType: "function"; toolCallId: string; toolName: string; args: string };
            tools: Record<string, unknown>;
            parameterSchema: (options: { toolName: string }) => unknown;
            error: Error;
          }) => {
            const result = await handler(params);
            const repaired = result !== null;

            pendingStepEvents.push({
              type: "tool_repair",
              toolName: params.toolCall.toolName,
              error: params.error.message,
              repaired,
            });

            if (repaired) {
              repairedToolCallsCount++;
            }

            return result;
          };
        })()
      : undefined;

    // prepareStep integration — call consumer's callback before streamText to get initial overrides
    let stepModel = providers.model(options.model);
    let stepActiveTools: string[] | undefined;
    let stepToolChoice: PrepareStepResult["toolChoice"] = undefined;

    if (options.prepareStep) {
      const overrides = options.prepareStep({
        stepNumber: 0,
        stepCount: 0,
        previousToolCalls: [],
      });
      if (overrides) {
        if (overrides.model) {
          stepModel = providers.model(overrides.model);
        }
        if (overrides.activeTools) {
          stepActiveTools = overrides.activeTools;
        }
        if (overrides.toolChoice) {
          stepToolChoice = overrides.toolChoice;
        }
      }
    }

    // Apply middleware pipeline to the model if provided
    const effectiveModel =
      options.middleware && options.middleware.length > 0
        ? wrapLanguageModel({ model: stepModel, middleware: options.middleware })
        : stepModel;

    // Build telemetry config for Vercel AI SDK when enabled
    const telemetryConfig: TelemetrySettings | undefined =
      options.telemetry?.enabled
        ? {
            isEnabled: true,
            functionId: options.telemetry.functionId ?? "ai-agent",
            recordInputs: false,
            recordOutputs: false,
            metadata: {
              sessionId,
              model: options.model,
              ...options.telemetry.metadata,
            },
          }
        : undefined;

    // stopWhen integration — AbortController to cancel the stream when condition is met
    const abortController = options.stopWhen ? new AbortController() : undefined;
    let stoppedByStopWhen = false;

    let result;
    try {
      result = streamText({
        model: effectiveModel,
        tools,
        maxSteps: options.maxSteps ?? DEFAULT_MAX_STEPS,
        messages,
        system: systemPrompt,
        ...(telemetryConfig ? { experimental_telemetry: telemetryConfig } : {}),
        ...(stepActiveTools ? { experimental_activeTools: stepActiveTools as any } : {}),
        ...(stepToolChoice ? { toolChoice: stepToolChoice as any } : {}),
        ...(abortController ? { abortSignal: abortController.signal } : {}),
        ...(experimentalRepairToolCall ? { experimental_repairToolCall: experimentalRepairToolCall } : {}),
        onStepFinish: (stepResult) => {
          const toolNames = (stepResult.toolCalls ?? []).map(
            (tc: { toolName: string }) => tc.toolName
          );
          const stepEvent = {
            type: "step_finish" as const,
            step: stepCounter,
            toolCalls: toolNames,
            finishReason: stepResult.finishReason ?? "unknown",
          };
          pendingStepEvents.push(stepEvent);

          // Collect per-step breakdown when telemetry is enabled (F-007)
          if (telemetryEnabled) {
            const now = Date.now();
            collectedSteps.push({
              stepNumber: stepCounter,
              toolCalls: toolNames,
              inputTokens: stepResult.usage?.promptTokens ?? 0,
              outputTokens: stepResult.usage?.completionTokens ?? 0,
              durationMs: now - stepStartMs,
            });
            stepStartMs = now;
          }

          previousToolCalls = toolNames;
          stepCounter++;

          // Evaluate stopWhen condition after recording the step event
          if (options.stopWhen && options.stopWhen(stepEvent)) {
            stoppedByStopWhen = true;
            abortController!.abort();
          }
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
        } else if (part.type === "tool-result") {
          // Drain tool_approval events pushed by wrapped execute functions (F-008)
          while (pendingStepEvents.length > 0) {
            yield pendingStepEvents.shift()!;
          }
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
      // If stopWhen triggered the abort, this is expected — continue normally
      if (stoppedByStopWhen && err instanceof Error && err.name === "AbortError") {
        // Expected abort — fall through to drain remaining events and finalize
      } else {
        // Re-throw with context if it's not already our error
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.startsWith("OpenRouter")) {
          throw new Error(`OpenRouter stream error: ${msg}`);
        }
        throw err;
      }
    }

    // Drain any remaining step events not yet emitted (edge case: stream ends without step-finish)
    while (pendingStepEvents.length > 0) {
      yield pendingStepEvents.shift()!;
    }

    // Persist session and collect usage — may fail if stream was aborted by stopWhen
    let usage = { promptTokens: 0, completionTokens: 0 };
    let steps: unknown[] = [];
    let finishReason: string = stoppedByStopWhen ? "stop_when" : "unknown";
    let totalCostUsd = 0;

    try {
      const response = await result.response;
      await saveSession(sessionDir, sessionId, [
        ...messages,
        ...response.messages as CoreMessage[],
      ]);

      usage = await result.usage;
      steps = await result.steps;
      finishReason = stoppedByStopWhen ? "stop_when" : (await result.finishReason ?? "unknown");

      // Fetch cost from OpenRouter generation endpoint
      const genId = response.id;
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
      // If stopWhen aborted the stream, response/usage promises may reject — use defaults
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
        stopReason: finishReason,
        // Tool repair count (F-004) — only populated when repairs occurred
        ...(repairedToolCallsCount > 0 ? { repairedToolCalls: repairedToolCallsCount } : {}),
        // Step breakdown — only populated when telemetry is enabled (F-007)
        ...(telemetryEnabled && collectedSteps.length > 0
          ? { steps: collectedSteps }
          : {}),
      },
    };
  } finally {
    // End session span before cleanup (F-006)
    sessionSpan?.end();

    // Close all MCP clients to avoid leaked connections/processes
    for (const client of mcpClients) {
      await client.close().catch(() => {});
    }
  }
}
