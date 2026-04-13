import { trace, SpanStatusCode, SpanKind, context } from "@opentelemetry/api";
import type { Span } from "@opentelemetry/api";
import { getTracer, isTelemetryEnabled, getOTelConfig } from "./index.js";
import { runAgent, type AgentEvent } from "../agent/index.js";

export type OperationMode = "chat" | "heartbeat" | "cron";

// --- Sampling & filtering ---

function shouldSample(mode: OperationMode, agentId: string): boolean {
  try {
    if (!isTelemetryEnabled()) return false;
    const cfg = getOTelConfig();
    if (cfg.operationFilter.length > 0 && !cfg.operationFilter.includes(mode)) return false;
    if (cfg.agentFilter.length > 0 && !cfg.agentFilter.includes(agentId)) return false;
    return Math.random() < cfg.samplingRate;
  } catch {
    return false;
  }
}

// --- MCP tool detection ---
// MCP tools follow the naming convention: mcp_{sanitisedAdapterSlug}_{sanitisedToolName}

function extractMcpInfo(
  toolName: string,
  knownAdapterSlugs: string[]
): { adapterId: string; serverLabel: string } | null {
  if (!toolName.startsWith("mcp_")) return null;

  const rest = toolName.slice(4);

  // Try to match against known adapter slugs first
  for (const slug of knownAdapterSlugs) {
    const sanitised = slug.replace(/[^a-zA-Z0-9]/g, "_");
    if (rest.startsWith(sanitised + "_")) {
      return { adapterId: slug, serverLabel: slug };
    }
  }

  // Fallback: use first segment as adapter_id
  const firstSeg = rest.split("_")[0] ?? "unknown";
  return { adapterId: firstSeg, serverLabel: firstSeg };
}

// --- Tool wrapping ---

function wrapToolsWithOTel(
  tools: Record<string, any>,
  parentSpan: Span,
  knownAdapterSlugs: string[] = []
): Record<string, any> {
  // Create a context that propagates the parent span to child spans
  const parentCtx = trace.setSpan(context.active(), parentSpan);

  return Object.fromEntries(
    Object.entries(tools).map(([name, toolDef]) => {
      if (!toolDef || typeof toolDef.execute !== "function") {
        return [name, toolDef];
      }

      const originalExecute = toolDef.execute as (args: unknown, ctx?: unknown) => Promise<unknown>;
      const mcpInfo = extractMcpInfo(name, knownAdapterSlugs);

      return [
        name,
        {
          ...toolDef,
          execute: async (args: unknown, ctx?: unknown) => {
            const start = Date.now();
            let childSpan: Span | undefined;

            try {
              const spanName = mcpInfo ? "gen_ai.mcp_call" : "gen_ai.tool_call";
              const spanKind = mcpInfo ? SpanKind.CLIENT : SpanKind.INTERNAL;
              const attrs: Record<string, string | number> = {
                "gen_ai.tool.name": name,
              };
              if (mcpInfo) {
                attrs["gen_ai.mcp.adapter_id"] = mcpInfo.adapterId;
                attrs["gen_ai.mcp.server_label"] = mcpInfo.serverLabel;
              }
              childSpan = getTracer().startSpan(
                spanName,
                { kind: spanKind, attributes: attrs },
                parentCtx
              );
            } catch {
              // OTel failure must not affect tool execution
            }

            try {
              const result = await originalExecute(args, ctx);
              try {
                childSpan?.setAttribute("gen_ai.tool.duration_ms", Date.now() - start);
                childSpan?.setAttribute("gen_ai.tool.status", "ok");
                childSpan?.setStatus({ code: SpanStatusCode.OK });
                childSpan?.end();
              } catch {}
              return result;
            } catch (err) {
              try {
                childSpan?.setAttribute("gen_ai.tool.duration_ms", Date.now() - start);
                childSpan?.setAttribute("gen_ai.tool.status", "error");
                childSpan?.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
                childSpan?.end();
              } catch {}
              throw err;
            }
          },
        },
      ];
    })
  );
}

// --- Main instrumented wrapper ---

export type InstrumentedRunAgentOptions = Parameters<typeof runAgent>[1] & {
  /** Known MCP adapter slugs — used to correctly tag mcp_ tools with adapter_id */
  knownAdapterSlugs?: string[];
  /** For cron spans: job identifier */
  cronJobId?: string;
  /** For cron spans: cron schedule expression */
  cronSchedule?: string;
  /** For heartbeat spans: the result status (ok/sent/skipped) */
  heartbeatResult?: string;
};

/**
 * Instruments a runAgent() call with OpenTelemetry spans.
 *
 * - Creates a root span `gen_ai.{mode}` (gen_ai.chat | gen_ai.heartbeat | gen_ai.cron)
 * - Wraps tool execute functions to emit child spans (gen_ai.tool_call or gen_ai.mcp_call)
 * - Captures usage attributes (input_tokens, output_tokens) from usage events
 * - Falls back to plain runAgent() transparently when telemetry is disabled or an OTel error occurs
 */
export async function* instrumentedRunAgent(
  agentId: string,
  mode: OperationMode,
  prompt: string,
  options?: InstrumentedRunAgentOptions
): AsyncGenerator<AgentEvent> {
  // Fast path: telemetry disabled or sampled out
  if (!shouldSample(mode, agentId)) {
    yield* runAgent(prompt, { ...options, agentId });
    return;
  }

  // Map "chat" → span name used for conversations
  const spanModeName = mode === "chat" ? "chat" : mode;
  const spanName = `gen_ai.${spanModeName}`;

  let span: Span | undefined;

  try {
    const attrs: Record<string, string | number> = {
      "gen_ai.system": "openrouter",
      "agent.id": agentId,
    };
    if (mode === "cron") {
      if (options?.cronJobId) attrs["gen_ai.cron.job_id"] = options.cronJobId;
      if (options?.cronSchedule) attrs["gen_ai.cron.schedule"] = options.cronSchedule;
    }
    span = getTracer().startSpan(spanName, { kind: SpanKind.CLIENT, attributes: attrs });
  } catch {
    // OTel failure — fall back to plain runAgent
    yield* runAgent(prompt, { ...options, agentId });
    return;
  }

  // Wrap tools with child span instrumentation
  const originalTools = options?.tools;
  const wrappedTools = originalTools
    ? wrapToolsWithOTel(originalTools, span, options?.knownAdapterSlugs ?? [])
    : undefined;

  // Intercept onResolved to capture the resolved model
  const originalOnResolved = options?.onResolved;
  const instrumentedOptions: Parameters<typeof runAgent>[1] = {
    ...options,
    agentId,
    tools: wrappedTools,
    onResolved: (result) => {
      try {
        span?.setAttribute("gen_ai.request.model", result.model);
      } catch {}
      originalOnResolved?.(result);
    },
  };

  try {
    for await (const event of runAgent(prompt, instrumentedOptions)) {
      if (event.type === "usage" && event.usage) {
        try {
          span.setAttribute("gen_ai.usage.input_tokens", event.usage.inputTokens);
          span.setAttribute("gen_ai.usage.output_tokens", event.usage.outputTokens);
          span.setAttribute("gen_ai.response.finish_reason", event.usage.stopReason);
          if (mode === "heartbeat" && options?.heartbeatResult) {
            span.setAttribute("gen_ai.heartbeat.result", options.heartbeatResult);
          }
        } catch {}
      }
      yield event;
    }
    try {
      span.setStatus({ code: SpanStatusCode.OK });
    } catch {}
  } catch (err) {
    try {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
    } catch {}
    throw err;
  } finally {
    try {
      span.end();
    } catch {}
  }
}
