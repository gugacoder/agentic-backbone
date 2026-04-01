import { readdirSync, existsSync } from "node:fs";
import { agentsDir, agentConfigPath, parseAgentId } from "../context/paths.js";
import { readYaml } from "../context/readers.js";
import { AgentYmlSchema } from "../context/schemas.js";
import {
  type AgentConfig,
  type HeartbeatConfig,
  type QuotaConfig,
} from "./types.js";

let cache: Map<string, AgentConfig> | null = null;

function parseAgentConfig(agentId: string): AgentConfig | null {
  const configPath = agentConfigPath(agentId);
  if (!existsSync(configPath)) return null;

  const raw = readYaml(configPath);
  const result = AgentYmlSchema.safeParse(raw);
  if (!result.success) {
    console.warn(`[agents] invalid AGENT.yml for ${agentId}:`, result.error.issues);
    return null;
  }

  const data = result.data;
  const { owner, slug } = parseAgentId(agentId);

  const heartbeat: HeartbeatConfig = {
    enabled: data["heartbeat-enabled"],
    intervalMs: data["heartbeat-interval"],
  };

  let quotas: QuotaConfig | undefined;
  if (data.quotas) {
    const q = data.quotas;
    quotas = {
      maxTokensPerHour: typeof q["max_tokens_per_hour"] === "number" ? q["max_tokens_per_hour"] : undefined,
      maxHeartbeatsDay: typeof q["max_heartbeats_day"] === "number" ? q["max_heartbeats_day"] : undefined,
      maxToolTimeoutMs: typeof q["max_tool_timeout_ms"] === "number" ? q["max_tool_timeout_ms"] : undefined,
      maxTokensPerRun: typeof q["max_tokens_per_run"] === "number" ? q["max_tokens_per_run"] : undefined,
      pauseOnExceed: typeof q["pause_on_exceed"] === "boolean" ? q["pause_on_exceed"] : undefined,
    };
  }

  return {
    id: data.id ?? agentId,
    owner: data.owner ?? owner,
    slug: data.slug ?? slug,
    delivery: data.delivery,
    enabled: data.enabled,
    heartbeat,
    metadata: data as Record<string, unknown>,
    description: data.description,
    role: data.role,
    members: data.members,
    quotas,
    adapters: data.adapters,
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
