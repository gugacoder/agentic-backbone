import { readdirSync, existsSync } from "node:fs";
import { agentsDir, agentConfigPath, parseAgentId } from "../context/paths.js";
import { parseFrontmatter, readContextFile } from "../context/frontmatter.js";
import {
  type AgentConfig,
  type HeartbeatConfig,
  type QuotaConfig,
  DEFAULT_HEARTBEAT_CONFIG,
} from "./types.js";

let cache: Map<string, AgentConfig> | null = null;

function parseAgentConfig(agentId: string): AgentConfig | null {
  const configPath = agentConfigPath(agentId);
  if (!existsSync(configPath)) return null;

  const raw = readContextFile(configPath);
  const { metadata, content } = parseFrontmatter(raw);
  const { owner, slug } = parseAgentId(agentId);

  const heartbeat: HeartbeatConfig = {
    enabled: metadata["heartbeat-enabled"] === true,
    intervalMs:
      typeof metadata["heartbeat-interval"] === "number"
        ? metadata["heartbeat-interval"]
        : DEFAULT_HEARTBEAT_CONFIG.intervalMs,
  };

  const enabled = metadata.enabled === true;

  const role = typeof metadata.role === "string" ? metadata.role : undefined;
  const members = Array.isArray(metadata.members)
    ? (metadata.members as string[]).filter((m) => typeof m === "string")
    : undefined;

  let quotas: QuotaConfig | undefined;
  if (metadata.quotas && typeof metadata.quotas === "object") {
    const q = metadata.quotas as Record<string, unknown>;
    quotas = {
      maxTokensPerHour: typeof q["max_tokens_per_hour"] === "number" ? q["max_tokens_per_hour"] : undefined,
      maxHeartbeatsDay: typeof q["max_heartbeats_day"] === "number" ? q["max_heartbeats_day"] : undefined,
      maxToolTimeoutMs: typeof q["max_tool_timeout_ms"] === "number" ? q["max_tool_timeout_ms"] : undefined,
      maxTokensPerRun: typeof q["max_tokens_per_run"] === "number" ? q["max_tokens_per_run"] : undefined,
      pauseOnExceed: typeof q["pause_on_exceed"] === "boolean" ? q["pause_on_exceed"] : undefined,
    };
  }

  return {
    id: (metadata.id as string) ?? agentId,
    owner: (metadata.owner as string) ?? owner,
    slug: (metadata.slug as string) ?? slug,
    delivery: (metadata.delivery as string) ?? "",
    enabled,
    heartbeat,
    metadata,
    description: content.trim(),
    role,
    members,
    quotas,
  };
}

function scanAgents(): Map<string, AgentConfig> {
  const dir = agentsDir();
  const map = new Map<string, AgentConfig>();
  if (!existsSync(dir)) return map;

  for (const entry of readdirSync(dir)) {
    // Agent dirs contain a dot (owner.slug)
    if (!entry.includes(".")) continue;
    const config = parseAgentConfig(entry);
    if (config) map.set(config.id, config);
  }
  return map;
}

function ensureCache(): Map<string, AgentConfig> {
  if (!cache) cache = scanAgents();
  return cache;
}

export function listAgents(): AgentConfig[] {
  return [...ensureCache().values()];
}

export function getAgent(id: string): AgentConfig | undefined {
  return ensureCache().get(id);
}

export function getSystemAgent(): AgentConfig | undefined {
  return getAgent("system.main");
}

export function refreshAgentRegistry(): void {
  cache = null;
}
