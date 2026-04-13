/**
 * Agent runner — wraps openclaude-sdk query() with backbone configuration.
 *
 * The backbone doesn't implement its own agent — it configures the Claude Code
 * agent (via openclaude-sdk) for each execution context. Skills, history,
 * settings live in CLAUDE_CONFIG_DIR. Tools come via MCP servers.
 *
 * SDKMessage → AgentEvent mapping happens here and ONLY here.
 * Consumers never import from @codrstudio/openclaude-sdk.
 */

import { query } from "@codrstudio/openclaude-sdk";
import type { ProviderRegistry } from "@codrstudio/openclaude-sdk";
import type {
  SDKMessage,
  SDKAssistantMessage,
  SDKUserMessage,
  SDKResultMessage,
  ContentBlock,
  ToolResultBlock,
} from "@codrstudio/openclaude-sdk";
import {
  resolve,
  getProviderConfig,
  type ResolvedLlm,
} from "../settings/llm.js";
import { ensureClaudeConfigDir } from "../agents/claude-config.js";
import { buildBuiltinMcpConfig } from "../mcp-server/builtin-config.js";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR, agentDir } from "../context/paths.js";
import type { AgentEvent, UsageData } from "./types.js";

export type { AgentEvent, UsageData } from "./types.js";
export type { ResolvedLlm };

const LOG_PATH = join(DATA_DIR, "agent-runs.jsonl");

function logAgentRun(entry: Record<string, unknown>): void {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    appendFileSync(LOG_PATH, JSON.stringify(entry) + "\n");
  } catch (err) {
    console.warn("[agent] failed to log run:", err);
  }
}

// --- Execution mode ---

export type AgentMode = "conversation" | "heartbeat" | "cron" | "request" | "webhook";

export interface RunAgentOptions {
  agentId: string;
  role?: string;
  mode?: AgentMode;
  system?: string;
  cwd?: string;
  onResolved?: (result: ResolvedLlm) => void;

  // Conversation mode
  sessionId?: string;
  resume?: string;

  // MCP
  mcpServers?: Record<string, unknown>;

  // Rich output (forwarded from chat)
  richOutput?: boolean;

  // Legacy compat — these are passed through but unused by openclaude-sdk
  messageMeta?: Record<string, unknown>;
  contentParts?: unknown[];
  disableDisplayTools?: boolean;

  // Telemetry hooks
  cronJobId?: string;
  cronSchedule?: string;
  heartbeatResult?: string;
  knownAdapterSlugs?: string[];
  tools?: Record<string, any>;
}

export async function* runAgent(
  prompt: string,
  options?: RunAgentOptions
): AsyncGenerator<AgentEvent> {
  const agentId = options?.agentId ?? process.env.AGENT_ID ?? "system.main";
  const role = options?.role ?? "conversation";
  const mode = options?.mode ?? (role as AgentMode);
  const resolved = resolve(role);
  options?.onResolved?.(resolved);

  // CLAUDE_CONFIG_DIR per agent
  const configDir = ensureClaudeConfigDir(agentId);

  // Build provider registry from plan resolution
  const providerConf = getProviderConfig(resolved.provider);
  const apiKey = process.env[providerConf.apiKeyEnv] ?? "";
  const registry: ProviderRegistry = {
    providers: [{
      id: resolved.provider,
      name: resolved.provider,
      type: resolved.provider === "groq" ? "openai" : "openai",
      baseUrl: providerConf.baseURL,
      apiKey,
    }],
    models: [{
      id: resolved.model,
      label: resolved.model,
      provider: resolved.provider,
      contextWindow: 128000,
    }],
    defaultModel: resolved.model,
  };

  // Build MCP servers
  const mcpServers: Record<string, unknown> = {};

  // Builtin MCP server (jobs, memory, cron, messages, emit, sysinfo)
  const builtinConfig = buildBuiltinMcpConfig(agentId);
  if (builtinConfig) {
    mcpServers["backbone-builtin"] = builtinConfig;
  }

  // Additional MCP servers from caller (adapters, etc.)
  if (options?.mcpServers) {
    Object.assign(mcpServers, options.mcpServers);
  }

  // Mode-specific options
  const isConversation = mode === "conversation";
  const persistSession = isConversation;
  const agentCwd = options?.cwd ?? agentDir(agentId);

  const systemLen = options?.system?.length ?? 0;
  const promptPreview = prompt.slice(0, 120).replace(/\n/g, "\\n");
  console.log(`[agent] agentId=${agentId} role=${role} mode=${mode} model=${resolved.model} system=${systemLen}ch prompt="${promptPreview}"`);

  logAgentRun({
    ts: new Date().toISOString(),
    agentId,
    role,
    mode,
    provider: resolved.provider,
    model: resolved.model,
    systemChars: systemLen,
    promptChars: prompt.length,
    hasIdentity: options?.system?.includes("<identity>") ?? false,
    hasInstructions: options?.system?.includes("<instructions>") ?? false,
    promptPreview: prompt.slice(0, 200),
  });

  // Build query options
  const queryOptions: Record<string, unknown> = {
    cwd: agentCwd,
    model: resolved.model,
    permissionMode: "bypassPermissions",
    maxTurns: 100,
    locale: "pt-BR",
    ...(options?.system ? { systemPrompt: options.system } : {}),
    ...(Object.keys(mcpServers).length > 0 ? { mcpServers } : {}),
    ...(options?.richOutput !== undefined ? { richOutput: options.richOutput } : {}),
    env: {
      CLAUDE_CONFIG_DIR: configDir,
    },
  };

  // Session management
  if (isConversation) {
    if (options?.resume) {
      queryOptions.resume = options.resume;
    } else if (options?.sessionId) {
      queryOptions.sessionId = options.sessionId;
    }
  }

  // persistSession: false for non-conversation modes (D-16)
  if (!persistSession) {
    queryOptions.persistSession = false;
  }

  const q = query({
    prompt,
    model: resolved.model,
    registry,
    options: queryOptions as any,
  });

  // Map SDKMessage → AgentEvent
  for await (const msg of q) {
    yield* mapSdkMessage(msg as SDKMessage);
  }
}

// --- SDKMessage → AgentEvent mapping ---
// This is the ONLY place SDKMessage is consumed. All downstream code uses AgentEvent.

function* mapSdkMessage(msg: SDKMessage): Generator<AgentEvent> {
  switch (msg.type) {
    case "assistant": {
      const assistantMsg = msg as SDKAssistantMessage;
      for (const block of assistantMsg.message.content) {
        if (block.type === "text") {
          yield { type: "text", content: block.text };
        } else if (block.type === "tool_use") {
          yield {
            type: "tool-call",
            toolCallId: block.id,
            toolName: block.name,
            args: block.input,
          };
        }
      }
      // SDKAssistantMessage boundary replaces step_finish (D-06)
      yield { type: "assistant-complete" };
      break;
    }

    case "user": {
      const userMsg = msg as SDKUserMessage;
      if (Array.isArray(userMsg.message.content)) {
        for (const block of userMsg.message.content as ToolResultBlock[]) {
          if (block.type === "tool_result") {
            yield {
              type: "tool-result",
              toolCallId: block.tool_use_id,
              result: block.content,
            };
          }
        }
      }
      break;
    }

    case "result": {
      const resultMsg = msg as SDKResultMessage;

      // Emit usage data
      const usage: UsageData = {
        inputTokens: resultMsg.usage.input_tokens,
        outputTokens: resultMsg.usage.output_tokens,
        cacheReadInputTokens: resultMsg.usage.cache_read_input_tokens,
        cacheCreationInputTokens: resultMsg.usage.cache_creation_input_tokens,
        totalCostUsd: resultMsg.total_cost_usd,
        numTurns: resultMsg.num_turns,
        durationMs: resultMsg.duration_ms,
        durationApiMs: resultMsg.duration_api_ms,
        stopReason: resultMsg.stop_reason ?? "end_turn",
      };
      yield { type: "usage", usage };

      // Emit result text
      if (resultMsg.subtype === "success") {
        yield { type: "result", content: resultMsg.result };
      } else {
        const errors = "errors" in resultMsg ? resultMsg.errors : [];
        yield { type: "result", content: errors.join("\n") || `Error: ${resultMsg.subtype}` };
      }
      break;
    }

    case "system": {
      const systemMsg = msg as { type: "system"; subtype: string; session_id?: string };
      if (systemMsg.subtype === "init" && systemMsg.session_id) {
        yield { type: "init", sessionId: systemMsg.session_id };
      }
      // Other system messages (compact_boundary, status, hooks, tasks) are ignored at backbone level
      break;
    }

    // stream_event contains raw API events (text deltas, etc.)
    // These are lower-level streaming events — ignored for now as
    // the assistant message has the full content blocks
    case "stream_event":
      break;

    // Tool progress, rate limits, suggestions — not consumed by backbone logic
    case "tool_progress":
    case "rate_limit_event":
    case "tool_use_summary":
    case "prompt_suggestion":
    case "auth_status":
    case "presence":
      break;
  }
}
