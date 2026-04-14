/**
 * Agent runner — wraps openclaude-sdk query() with backbone configuration.
 *
 * The backbone doesn't implement its own agent — it configures the Claude Code
 * agent (via openclaude-sdk) for each execution context. Skills, history,
 * settings live in CLAUDE_CONFIG_DIR. Tools come via MCP servers.
 *
 * runAgent() yields SDKMessage directly — no intermediate mapping layer.
 * Consumers import SDKMessage types from @codrstudio/openclaude-sdk.
 */

import { query } from "@codrstudio/openclaude-sdk";
import type { ProviderRegistry } from "@codrstudio/openclaude-sdk";
export type {
  SDKMessage,
  SDKAssistantMessage,
  SDKUserMessage,
  SDKResultMessage,
  SDKSystemMessage,
  ContentBlock,
  ToolResultBlock,
} from "@codrstudio/openclaude-sdk";
import type { SDKMessage } from "@codrstudio/openclaude-sdk";
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
import type { UsageData } from "./types.js";

export type { UsageData } from "./types.js";
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
): AsyncGenerator<SDKMessage> {
  const agentId = options?.agentId ?? process.env.AGENT_ID ?? "system.main";
  const role = options?.role ?? "conversation";
  const mode = options?.mode ?? (role as AgentMode);
  const resolved = resolve(role);
  options?.onResolved?.(resolved);

  // CLAUDE_CONFIG_DIR per agent
  const configDir = ensureClaudeConfigDir(agentId);

  // Build provider registry from plan resolution (only for known providers)
  const providerConf = getProviderConfig(resolved.provider);
  let registry: ProviderRegistry | undefined;
  if (providerConf && resolved.model) {
    const apiKey = process.env[providerConf.apiKeyEnv] ?? "";
    registry = {
      providers: [{
        id: resolved.provider,
        name: resolved.provider,
        type: "openai",
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
  }

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
  console.log(`[agent] agentId=${agentId} role=${role} mode=${mode} model=${resolved.model ?? "(native)"} provider=${resolved.provider} system=${systemLen}ch prompt="${promptPreview}"`);

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
    ...(resolved.model ? { model: resolved.model } : {}),
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
    ...(resolved.model ? { model: resolved.model } : {}),
    ...(registry ? { registry } : {}),
    options: queryOptions as any,
  });

  // Yield SDKMessage directly — no mapping layer (milestone 25, D-01)
  for await (const msg of q) {
    yield msg as SDKMessage;
  }
}
