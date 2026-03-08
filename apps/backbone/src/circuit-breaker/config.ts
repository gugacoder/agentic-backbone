import { db } from "../db/index.js";
import type { CircuitBreakerConfig, CircuitBreakerConfigUpdate } from "./schemas.js";

interface DbRow {
  agent_id: string;
  enabled: number;
  max_consecutive_fails: number;
  error_rate_threshold: number;
  error_rate_window_min: number;
  max_actions_per_hour: number;
  max_actions_per_day: number;
  cooldown_min: number;
  auto_resume: number;
  updated_at: string;
}

const DEFAULTS: Omit<CircuitBreakerConfig, "agentId"> = {
  enabled: true,
  maxConsecutiveFails: 5,
  errorRateThreshold: 0.5,
  errorRateWindowMin: 10,
  maxActionsPerHour: 100,
  maxActionsPerDay: 1000,
  cooldownMin: 30,
  autoResume: false,
};

function rowToConfig(row: DbRow): CircuitBreakerConfig {
  return {
    agentId: row.agent_id,
    enabled: row.enabled === 1,
    maxConsecutiveFails: row.max_consecutive_fails,
    errorRateThreshold: row.error_rate_threshold,
    errorRateWindowMin: row.error_rate_window_min,
    maxActionsPerHour: row.max_actions_per_hour,
    maxActionsPerDay: row.max_actions_per_day,
    cooldownMin: row.cooldown_min,
    autoResume: row.auto_resume === 1,
  };
}

const selectConfig = db.prepare<{ agent_id: string }, DbRow>(
  `SELECT * FROM circuit_breaker_config WHERE agent_id = :agent_id`
);

const upsertConfig = db.prepare(`
  INSERT INTO circuit_breaker_config (
    agent_id, enabled, max_consecutive_fails, error_rate_threshold,
    error_rate_window_min, max_actions_per_hour, max_actions_per_day,
    cooldown_min, auto_resume, updated_at
  ) VALUES (
    :agent_id, :enabled, :max_consecutive_fails, :error_rate_threshold,
    :error_rate_window_min, :max_actions_per_hour, :max_actions_per_day,
    :cooldown_min, :auto_resume, datetime('now')
  )
  ON CONFLICT(agent_id) DO UPDATE SET
    enabled               = excluded.enabled,
    max_consecutive_fails = excluded.max_consecutive_fails,
    error_rate_threshold  = excluded.error_rate_threshold,
    error_rate_window_min = excluded.error_rate_window_min,
    max_actions_per_hour  = excluded.max_actions_per_hour,
    max_actions_per_day   = excluded.max_actions_per_day,
    cooldown_min          = excluded.cooldown_min,
    auto_resume           = excluded.auto_resume,
    updated_at            = datetime('now')
`);

export function getConfig(agentId: string): CircuitBreakerConfig {
  const row = selectConfig.get({ agent_id: agentId });
  if (row) return rowToConfig(row);
  return { agentId, ...DEFAULTS };
}

export function saveConfig(agentId: string, update: CircuitBreakerConfigUpdate): CircuitBreakerConfig {
  const current = getConfig(agentId);
  const merged: CircuitBreakerConfig = { ...current, ...update, agentId };
  upsertConfig.run({
    agent_id: merged.agentId,
    enabled: merged.enabled ? 1 : 0,
    max_consecutive_fails: merged.maxConsecutiveFails,
    error_rate_threshold: merged.errorRateThreshold,
    error_rate_window_min: merged.errorRateWindowMin,
    max_actions_per_hour: merged.maxActionsPerHour,
    max_actions_per_day: merged.maxActionsPerDay,
    cooldown_min: merged.cooldownMin,
    auto_resume: merged.autoResume ? 1 : 0,
  });
  return merged;
}
