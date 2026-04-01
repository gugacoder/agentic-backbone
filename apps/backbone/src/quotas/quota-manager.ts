import { db } from "../db/index.js";
import { getAgent } from "../agents/registry.js";
import { agentConfigPath } from "../context/paths.js";
import { readYamlAs, writeYamlAs } from "../context/readers.js";
import { AgentYmlSchema } from "../context/schemas.js";
import type { QuotaConfig } from "../agents/types.js";

export type WindowType = "hourly" | "daily";

export interface QuotaUsage {
  agentId: string;
  windowType: WindowType;
  windowStart: string;
  tokensUsed: number;
  heartbeats: number;
  toolCalls: number;
}

export interface CheckResult {
  exceeded: boolean;
  reason?: string;
}

function hourlyWindow(): string {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  return now.toISOString().replace("T", " ").substring(0, 19);
}

function dailyWindow(): string {
  const now = new Date();
  return now.toISOString().substring(0, 10);
}

const selectDbQuota = db.prepare<{ agent_id: string }, {
  agent_id: string;
  max_tokens_per_hour: number | null;
  max_heartbeats_day: number | null;
  max_tool_timeout_ms: number | null;
  max_tokens_per_run: number | null;
  pause_on_exceed: number;
}>(`SELECT * FROM agent_quotas WHERE agent_id = :agent_id`);

const selectUsage = db.prepare<{ agent_id: string; window_type: string; window_start: string }, {
  id: number;
  agent_id: string;
  window_type: string;
  window_start: string;
  tokens_used: number;
  heartbeats: number;
  tool_calls: number;
}>(`SELECT * FROM agent_quota_usage WHERE agent_id = :agent_id AND window_type = :window_type AND window_start = :window_start`);

const upsertUsage = db.prepare(`
  INSERT INTO agent_quota_usage (agent_id, window_type, window_start, tokens_used, heartbeats, tool_calls, updated_at)
  VALUES (:agent_id, :window_type, :window_start, :tokens_used, :heartbeats, :tool_calls, datetime('now'))
  ON CONFLICT(agent_id, window_type, window_start) DO UPDATE SET
    tokens_used = tokens_used + excluded.tokens_used,
    heartbeats  = heartbeats  + excluded.heartbeats,
    tool_calls  = tool_calls  + excluded.tool_calls,
    updated_at  = datetime('now')
`);

/**
 * Returns quota config for the agent.
 * DB row overrides frontmatter when present.
 */
export function getQuotas(agentId: string): QuotaConfig {
  const dbRow = selectDbQuota.get({ agent_id: agentId });
  if (dbRow) {
    return {
      maxTokensPerHour: dbRow.max_tokens_per_hour ?? undefined,
      maxHeartbeatsDay: dbRow.max_heartbeats_day ?? undefined,
      maxToolTimeoutMs: dbRow.max_tool_timeout_ms ?? undefined,
      maxTokensPerRun: dbRow.max_tokens_per_run ?? undefined,
      pauseOnExceed: dbRow.pause_on_exceed === 1,
    };
  }
  const agent = getAgent(agentId);
  return agent?.quotas ?? {};
}

/**
 * Returns usage for the specified agent/window.
 */
export function getUsage(agentId: string, windowType: WindowType, windowStart: string): QuotaUsage {
  const row = selectUsage.get({ agent_id: agentId, window_type: windowType, window_start: windowStart });
  return {
    agentId,
    windowType,
    windowStart,
    tokensUsed: row?.tokens_used ?? 0,
    heartbeats: row?.heartbeats ?? 0,
    toolCalls: row?.tool_calls ?? 0,
  };
}

/**
 * Records token/heartbeat/tool usage for both hourly and daily windows.
 */
export function recordUsage(
  agentId: string,
  tokensIn: number,
  tokensOut: number,
  mode: "heartbeat" | "conversation" | "cron",
): void {
  const totalTokens = tokensIn + tokensOut;
  const isHeartbeat = mode === "heartbeat" ? 1 : 0;

  const hourly = hourlyWindow();
  const daily = dailyWindow();

  upsertUsage.run({
    agent_id: agentId,
    window_type: "hourly",
    window_start: hourly,
    tokens_used: totalTokens,
    heartbeats: isHeartbeat,
    tool_calls: 0,
  });
  upsertUsage.run({
    agent_id: agentId,
    window_type: "daily",
    window_start: daily,
    tokens_used: totalTokens,
    heartbeats: isHeartbeat,
    tool_calls: 0,
  });
}

/**
 * Increments tool_calls counter for the current hourly window.
 */
export function recordToolCall(agentId: string): void {
  const hourly = hourlyWindow();
  upsertUsage.run({
    agent_id: agentId,
    window_type: "hourly",
    window_start: hourly,
    tokens_used: 0,
    heartbeats: 0,
    tool_calls: 1,
  });
}

/**
 * Writes enabled: false to the agent's AGENT.yml.
 * Used to auto-pause an agent when quota is exceeded and pause_on_exceed is true.
 */
export function pauseAgent(agentId: string): void {
  const path = agentConfigPath(agentId);
  let data: ReturnType<typeof AgentYmlSchema.parse>;
  try {
    data = readYamlAs(path, AgentYmlSchema);
  } catch {
    console.warn(`[quota] could not read AGENT.yml for ${agentId}`);
    return;
  }

  if (data.enabled === false) return;

  try {
    writeYamlAs(path, { ...data, enabled: false }, AgentYmlSchema);
    console.log(`[quota] agent ${agentId} paused (enabled: false written to AGENT.yml)`);
  } catch (err) {
    console.warn(`[quota] could not write AGENT.yml for ${agentId}:`, err);
  }
}

/**
 * Checks whether a quota is exceeded for the agent.
 * Returns { exceeded: false } if all limits are within bounds.
 */
export function checkExceeded(agentId: string, mode: "heartbeat" | "conversation" | "cron"): CheckResult {
  const quotas = getQuotas(agentId);

  if (quotas.maxTokensPerHour !== undefined) {
    const hourly = getUsage(agentId, "hourly", hourlyWindow());
    if (hourly.tokensUsed >= quotas.maxTokensPerHour) {
      return { exceeded: true, reason: `max_tokens_per_hour (${quotas.maxTokensPerHour}) exceeded: ${hourly.tokensUsed} used` };
    }
  }

  if (mode === "heartbeat" && quotas.maxHeartbeatsDay !== undefined) {
    const daily = getUsage(agentId, "daily", dailyWindow());
    if (daily.heartbeats >= quotas.maxHeartbeatsDay) {
      return { exceeded: true, reason: `max_heartbeats_day (${quotas.maxHeartbeatsDay}) exceeded: ${daily.heartbeats} today` };
    }
  }

  return { exceeded: false };
}
