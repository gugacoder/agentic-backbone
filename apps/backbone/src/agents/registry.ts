import { readdirSync, existsSync } from "node:fs";
import { agentsDir, agentConfigPath, parseAgentId } from "../context/paths.js";
import { parseFrontmatter } from "../context/frontmatter.js";
import { readFileSync } from "node:fs";
import {
  type AgentConfig,
  type HeartbeatConfig,
  DEFAULT_HEARTBEAT_CONFIG,
} from "./types.js";

let cache: Map<string, AgentConfig> | null = null;

function parseAgentConfig(agentId: string): AgentConfig | null {
  const configPath = agentConfigPath(agentId);
  if (!existsSync(configPath)) return null;

  const raw = readFileSync(configPath, "utf-8");
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

  return {
    id: (metadata.id as string) ?? agentId,
    owner: (metadata.owner as string) ?? owner,
    slug: (metadata.slug as string) ?? slug,
    delivery: (metadata.delivery as string) ?? "",
    enabled,
    heartbeat,
    metadata,
    description: content.trim(),
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
