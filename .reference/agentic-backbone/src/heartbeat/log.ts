import { db } from "../db/index.js";
import type { UsageData } from "../agent/index.js";

export interface HeartbeatLogParams {
  agentId: string;
  status: string;
  durationMs?: number;
  usage?: UsageData;
  reason?: string;
  preview?: string;
}

export interface HeartbeatLogEntry {
  id: number;
  agent_id: string;
  ts: string;
  status: string;
  duration_ms: number | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  cost_usd: number;
  num_turns: number;
  stop_reason: string | null;
  reason: string | null;
  preview: string | null;
}

export interface HeartbeatStats {
  totalExecutions: number;
  countByStatus: Record<string, number>;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheCreationTokens: number;
  totalCostUsd: number;
  avgDurationMs: number;
}

const insertStmt = db.prepare(`
  INSERT INTO heartbeat_log
    (agent_id, status, duration_ms, input_tokens, output_tokens,
     cache_read_tokens, cache_creation_tokens, cost_usd, num_turns,
     stop_reason, reason, preview)
  VALUES
    (@agentId, @status, @durationMs, @inputTokens, @outputTokens,
     @cacheReadTokens, @cacheCreationTokens, @costUsd, @numTurns,
     @stopReason, @reason, @preview)
`);

const historyStmt = db.prepare(`
  SELECT * FROM heartbeat_log
  WHERE agent_id = ?
  ORDER BY ts DESC
  LIMIT ? OFFSET ?
`);

const countStmt = db.prepare(`
  SELECT COUNT(*) as total FROM heartbeat_log WHERE agent_id = ?
`);

const statsStmt = db.prepare(`
  SELECT
    COUNT(*)                     AS totalExecutions,
    COALESCE(SUM(input_tokens), 0)   AS totalInputTokens,
    COALESCE(SUM(output_tokens), 0)  AS totalOutputTokens,
    COALESCE(SUM(cache_read_tokens), 0)      AS totalCacheReadTokens,
    COALESCE(SUM(cache_creation_tokens), 0)  AS totalCacheCreationTokens,
    COALESCE(SUM(cost_usd), 0)       AS totalCostUsd,
    COALESCE(AVG(duration_ms), 0)    AS avgDurationMs
  FROM heartbeat_log
  WHERE agent_id = ?
`);

const statusCountStmt = db.prepare(`
  SELECT status, COUNT(*) as count
  FROM heartbeat_log
  WHERE agent_id = ?
  GROUP BY status
`);

const globalStatsStmt = db.prepare(`
  SELECT
    agent_id,
    COUNT(*)                     AS totalExecutions,
    COALESCE(SUM(input_tokens), 0)   AS totalInputTokens,
    COALESCE(SUM(output_tokens), 0)  AS totalOutputTokens,
    COALESCE(SUM(cost_usd), 0)       AS totalCostUsd,
    COALESCE(AVG(duration_ms), 0)    AS avgDurationMs
  FROM heartbeat_log
  GROUP BY agent_id
`);

const globalStatusCountStmt = db.prepare(`
  SELECT agent_id, status, COUNT(*) as count
  FROM heartbeat_log
  GROUP BY agent_id, status
`);

export function logHeartbeat(params: HeartbeatLogParams): void {
  const u = params.usage;
  insertStmt.run({
    agentId: params.agentId,
    status: params.status,
    durationMs: params.durationMs ?? null,
    inputTokens: u?.inputTokens ?? 0,
    outputTokens: u?.outputTokens ?? 0,
    cacheReadTokens: u?.cacheReadInputTokens ?? 0,
    cacheCreationTokens: u?.cacheCreationInputTokens ?? 0,
    costUsd: u?.totalCostUsd ?? 0,
    numTurns: u?.numTurns ?? 0,
    stopReason: u?.stopReason ?? null,
    reason: params.reason ?? null,
    preview: params.preview ?? null,
  });
}

export function getHeartbeatHistory(
  agentId: string,
  opts: { limit?: number; offset?: number } = {}
): { rows: HeartbeatLogEntry[]; total: number } {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  const rows = historyStmt.all(agentId, limit, offset) as HeartbeatLogEntry[];
  const { total } = countStmt.get(agentId) as { total: number };
  return { rows, total };
}

export function getHeartbeatStats(agentId: string): HeartbeatStats {
  const row = statsStmt.get(agentId) as Record<string, number>;
  const statusRows = statusCountStmt.all(agentId) as { status: string; count: number }[];
  const countByStatus: Record<string, number> = {};
  for (const r of statusRows) countByStatus[r.status] = r.count;

  return {
    totalExecutions: row.totalExecutions,
    countByStatus,
    totalInputTokens: row.totalInputTokens,
    totalOutputTokens: row.totalOutputTokens,
    totalCacheReadTokens: row.totalCacheReadTokens,
    totalCacheCreationTokens: row.totalCacheCreationTokens,
    totalCostUsd: row.totalCostUsd,
    avgDurationMs: row.avgDurationMs,
  };
}

export interface GlobalAgentStats {
  agentId: string;
  totalExecutions: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  avgDurationMs: number;
  countByStatus: Record<string, number>;
}

export function getGlobalHeartbeatStats(): GlobalAgentStats[] {
  const rows = globalStatsStmt.all() as {
    agent_id: string;
    totalExecutions: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostUsd: number;
    avgDurationMs: number;
  }[];
  const statusRows = globalStatusCountStmt.all() as {
    agent_id: string;
    status: string;
    count: number;
  }[];

  const statusMap = new Map<string, Record<string, number>>();
  for (const r of statusRows) {
    if (!statusMap.has(r.agent_id)) statusMap.set(r.agent_id, {});
    statusMap.get(r.agent_id)![r.status] = r.count;
  }

  return rows.map((r) => ({
    agentId: r.agent_id,
    totalExecutions: r.totalExecutions,
    totalInputTokens: r.totalInputTokens,
    totalOutputTokens: r.totalOutputTokens,
    totalCostUsd: r.totalCostUsd,
    avgDurationMs: r.avgDurationMs,
    countByStatus: statusMap.get(r.agent_id) ?? {},
  }));
}
