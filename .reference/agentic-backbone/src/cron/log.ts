import { db } from "../db/index.js";

export interface CronRunLogParams {
  jobSlug: string;
  agentId: string;
  status: string;
  durationMs?: number;
  error?: string;
  summary?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
}

export interface CronRunLogEntry {
  id: number;
  job_slug: string;
  agent_id: string;
  ts: string;
  status: string;
  duration_ms: number | null;
  error: string | null;
  summary: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

const insertStmt = db.prepare(`
  INSERT INTO cron_run_log
    (job_slug, agent_id, status, duration_ms, error, summary,
     input_tokens, output_tokens, cost_usd)
  VALUES
    (@jobSlug, @agentId, @status, @durationMs, @error, @summary,
     @inputTokens, @outputTokens, @costUsd)
`);

const historyStmt = db.prepare(`
  SELECT * FROM cron_run_log
  WHERE job_slug = ?
  ORDER BY ts DESC
  LIMIT ? OFFSET ?
`);

const countStmt = db.prepare(`
  SELECT COUNT(*) as total FROM cron_run_log WHERE job_slug = ?
`);

export function logCronRun(params: CronRunLogParams): void {
  insertStmt.run({
    jobSlug: params.jobSlug,
    agentId: params.agentId,
    status: params.status,
    durationMs: params.durationMs ?? null,
    error: params.error ?? null,
    summary: params.summary ?? null,
    inputTokens: params.inputTokens ?? 0,
    outputTokens: params.outputTokens ?? 0,
    costUsd: params.costUsd ?? 0,
  });
}

export function getCronRunHistory(
  jobSlug: string,
  opts: { limit?: number; offset?: number } = {}
): { rows: CronRunLogEntry[]; total: number } {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  const rows = historyStmt.all(jobSlug, limit, offset) as CronRunLogEntry[];
  const { total } = countStmt.get(jobSlug) as { total: number };
  return { rows, total };
}
