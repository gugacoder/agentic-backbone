import { db } from "./index.js";

export interface TrackHeartbeatParams {
  agentId: string;
  status: "ok" | "error" | "skipped";
  durationMs?: number;
}

const heartbeatStmt = db.prepare(`
  INSERT INTO analytics_daily (date, agent_id, heartbeats_total, heartbeats_ok, heartbeats_error, heartbeats_skipped, response_ms_sum, response_ms_count, avg_response_ms)
  VALUES (date('now'), @agentId, 1, @ok, @error, @skipped, @msSum, @msCount, @avgMs)
  ON CONFLICT(date, agent_id) DO UPDATE SET
    heartbeats_total   = heartbeats_total + 1,
    heartbeats_ok      = heartbeats_ok + @ok,
    heartbeats_error   = heartbeats_error + @error,
    heartbeats_skipped = heartbeats_skipped + @skipped,
    response_ms_sum    = response_ms_sum + @msSum,
    response_ms_count  = response_ms_count + @msCount,
    avg_response_ms    = CASE WHEN (response_ms_count + @msCount) > 0
                         THEN (response_ms_sum + @msSum) / (response_ms_count + @msCount)
                         ELSE NULL END
`);

export function trackHeartbeat(params: TrackHeartbeatParams): void {
  const msSum = params.durationMs ?? 0;
  const msCount = params.durationMs != null ? 1 : 0;
  heartbeatStmt.run({
    agentId: params.agentId,
    ok: params.status === "ok" ? 1 : 0,
    error: params.status === "error" ? 1 : 0,
    skipped: params.status === "skipped" ? 1 : 0,
    msSum,
    msCount,
    avgMs: msCount > 0 ? msSum : null,
  });
}

export interface TrackConversationParams {
  agentId: string;
  messagesIn: number;
  messagesOut: number;
  durationMs?: number;
}

const conversationStmt = db.prepare(`
  INSERT INTO analytics_daily (date, agent_id, conversations, messages_in, messages_out, response_ms_sum, response_ms_count, avg_response_ms)
  VALUES (date('now'), @agentId, 1, @messagesIn, @messagesOut, @msSum, @msCount, @avgMs)
  ON CONFLICT(date, agent_id) DO UPDATE SET
    conversations     = conversations + 1,
    messages_in       = messages_in + @messagesIn,
    messages_out      = messages_out + @messagesOut,
    response_ms_sum   = response_ms_sum + @msSum,
    response_ms_count = response_ms_count + @msCount,
    avg_response_ms   = CASE WHEN (response_ms_count + @msCount) > 0
                        THEN (response_ms_sum + @msSum) / (response_ms_count + @msCount)
                        ELSE NULL END
`);

export function trackConversation(params: TrackConversationParams): void {
  const msSum = params.durationMs ?? 0;
  const msCount = params.durationMs != null ? 1 : 0;
  conversationStmt.run({
    agentId: params.agentId,
    messagesIn: params.messagesIn,
    messagesOut: params.messagesOut,
    msSum,
    msCount,
    avgMs: msCount > 0 ? msSum : null,
  });
}

export interface TrackCronParams {
  agentId: string;
  status: "ok" | "error";
  durationMs?: number;
}

const cronStmt = db.prepare(`
  INSERT INTO analytics_daily (date, agent_id, cron_total, cron_ok, cron_error, response_ms_sum, response_ms_count, avg_response_ms)
  VALUES (date('now'), @agentId, 1, @ok, @error, @msSum, @msCount, @avgMs)
  ON CONFLICT(date, agent_id) DO UPDATE SET
    cron_total        = cron_total + 1,
    cron_ok           = cron_ok + @ok,
    cron_error        = cron_error + @error,
    response_ms_sum   = response_ms_sum + @msSum,
    response_ms_count = response_ms_count + @msCount,
    avg_response_ms   = CASE WHEN (response_ms_count + @msCount) > 0
                        THEN (response_ms_sum + @msSum) / (response_ms_count + @msCount)
                        ELSE NULL END
`);

export function trackCron(params: TrackCronParams): void {
  const msSum = params.durationMs ?? 0;
  const msCount = params.durationMs != null ? 1 : 0;
  cronStmt.run({
    agentId: params.agentId,
    ok: params.status === "ok" ? 1 : 0,
    error: params.status === "error" ? 1 : 0,
    msSum,
    msCount,
    avgMs: msCount > 0 ? msSum : null,
  });
}
