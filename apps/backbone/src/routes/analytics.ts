import { Hono } from "hono";
import { db } from "../db/index.js";

export const analyticsRoutes = new Hono();

// ── GET /analytics/overview ────────────────────────────────

analyticsRoutes.get("/analytics/overview", (c) => {
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
    .toISOString()
    .slice(0, 10);

  const from = c.req.query("from") ?? sevenDaysAgo;
  const to = c.req.query("to") ?? today;
  const agentId = c.req.query("agent_id");

  const agentFilter = agentId ? " AND agent_id = ?" : "";
  const params: unknown[] = [from, to];
  if (agentId) params.push(agentId);

  const row = db
    .prepare(
      `SELECT
         COALESCE(SUM(heartbeats_total), 0) AS hTotal,
         COALESCE(SUM(heartbeats_ok), 0) AS hOk,
         COALESCE(SUM(heartbeats_error), 0) AS hError,
         COALESCE(SUM(heartbeats_skipped), 0) AS hSkipped,
         COALESCE(SUM(conversations), 0) AS convTotal,
         COALESCE(SUM(messages_in), 0) AS msgIn,
         COALESCE(SUM(messages_out), 0) AS msgOut,
         COALESCE(SUM(cron_total), 0) AS cTotal,
         COALESCE(SUM(cron_ok), 0) AS cOk,
         COALESCE(SUM(cron_error), 0) AS cError,
         COALESCE(SUM(response_ms_sum), 0) AS msSum,
         COALESCE(SUM(response_ms_count), 0) AS msCount
       FROM analytics_daily
       WHERE date >= ? AND date <= ?${agentFilter}`,
    )
    .get(...params) as {
    hTotal: number;
    hOk: number;
    hError: number;
    hSkipped: number;
    convTotal: number;
    msgIn: number;
    msgOut: number;
    cTotal: number;
    cOk: number;
    cError: number;
    msSum: number;
    msCount: number;
  };

  const avgResponseMs =
    row.msCount > 0 ? Math.round(row.msSum / row.msCount) : 0;
  const heartbeatErrorRate =
    row.hTotal > 0 ? row.hError / row.hTotal : 0;
  const cronErrorRate = row.cTotal > 0 ? row.cError / row.cTotal : 0;

  // Compute comparison period: same duration, immediately before `from`
  const fromDate = new Date(from + "T00:00:00Z");
  const toDate = new Date(to + "T00:00:00Z");
  const durationMs = toDate.getTime() - fromDate.getTime() + 86400000; // inclusive
  const prevTo = new Date(fromDate.getTime() - 86400000)
    .toISOString()
    .slice(0, 10);
  const prevFrom = new Date(fromDate.getTime() - durationMs)
    .toISOString()
    .slice(0, 10);

  const prevParams: unknown[] = [prevFrom, prevTo];
  if (agentId) prevParams.push(agentId);

  const prev = db
    .prepare(
      `SELECT
         COALESCE(SUM(heartbeats_total), 0) AS hTotal,
         COALESCE(SUM(heartbeats_error), 0) AS hError,
         COALESCE(SUM(conversations), 0) AS convTotal,
         COALESCE(SUM(cron_total), 0) AS cTotal,
         COALESCE(SUM(cron_error), 0) AS cError,
         COALESCE(SUM(response_ms_sum), 0) AS msSum,
         COALESCE(SUM(response_ms_count), 0) AS msCount
       FROM analytics_daily
       WHERE date >= ? AND date <= ?${agentFilter}`,
    )
    .get(...prevParams) as {
    hTotal: number;
    hError: number;
    convTotal: number;
    cTotal: number;
    cError: number;
    msSum: number;
    msCount: number;
  };

  const prevHeartbeatErrorRate =
    prev.hTotal > 0 ? prev.hError / prev.hTotal : 0;
  const prevAvgResponseMs =
    prev.msCount > 0 ? Math.round(prev.msSum / prev.msCount) : 0;

  return c.json({
    heartbeats: {
      total: row.hTotal,
      ok: row.hOk,
      error: row.hError,
      skipped: row.hSkipped,
      errorRate: Math.round(heartbeatErrorRate * 1000) / 1000,
    },
    conversations: {
      total: row.convTotal,
      messagesIn: row.msgIn,
      messagesOut: row.msgOut,
    },
    cron: {
      total: row.cTotal,
      ok: row.cOk,
      error: row.cError,
      errorRate: Math.round(cronErrorRate * 1000) / 1000,
    },
    avgResponseMs,
    comparison: {
      heartbeatErrorRateDelta:
        Math.round((heartbeatErrorRate - prevHeartbeatErrorRate) * 1000) / 1000,
      conversationsDelta: row.convTotal - prev.convTotal,
      avgResponseMsDelta: avgResponseMs - prevAvgResponseMs,
    },
  });
});

// ── GET /analytics/trend ───────────────────────────────────

analyticsRoutes.get("/analytics/trend", (c) => {
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
    .toISOString()
    .slice(0, 10);

  const from = c.req.query("from") ?? sevenDaysAgo;
  const to = c.req.query("to") ?? today;
  const metric = c.req.query("metric") ?? "heartbeats";
  const agentId = c.req.query("agent_id");

  const agentFilter = agentId ? " AND agent_id = ?" : "";
  const params: unknown[] = [from, to];
  if (agentId) params.push(agentId);

  type PointRow = Record<string, unknown>;

  let selectCols: string;
  switch (metric) {
    case "heartbeats":
      selectCols = `
        date,
        SUM(heartbeats_ok) AS ok,
        SUM(heartbeats_error) AS error,
        SUM(heartbeats_skipped) AS skipped`;
      break;
    case "conversations":
      selectCols = `
        date,
        SUM(conversations) AS total,
        SUM(messages_in) AS messagesIn,
        SUM(messages_out) AS messagesOut`;
      break;
    case "errors":
      selectCols = `
        date,
        SUM(heartbeats_error) AS heartbeatErrors,
        SUM(cron_error) AS cronErrors`;
      break;
    case "response_time":
      selectCols = `
        date,
        CASE WHEN SUM(response_ms_count) > 0
          THEN ROUND(SUM(response_ms_sum) / SUM(response_ms_count))
          ELSE 0 END AS avgMs`;
      break;
    default:
      return c.json({ error: "metric must be heartbeats, conversations, errors, or response_time" }, 400);
  }

  const points = db
    .prepare(
      `SELECT ${selectCols}
       FROM analytics_daily
       WHERE date >= ? AND date <= ?${agentFilter}
       GROUP BY date
       ORDER BY date ASC`,
    )
    .all(...params) as PointRow[];

  return c.json({ metric, points });
});

// ── GET /analytics/agents ──────────────────────────────────

analyticsRoutes.get("/analytics/agents", (c) => {
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
    .toISOString()
    .slice(0, 10);

  const from = c.req.query("from") ?? sevenDaysAgo;
  const to = c.req.query("to") ?? today;

  const analyticsRows = db
    .prepare(
      `SELECT
         agent_id AS agentId,
         SUM(heartbeats_total) AS heartbeats,
         SUM(heartbeats_error) AS heartbeatErrors,
         SUM(conversations) AS conversations,
         SUM(response_ms_sum) AS msSum,
         SUM(response_ms_count) AS msCount
       FROM analytics_daily
       WHERE date >= ? AND date <= ?
       GROUP BY agent_id
       ORDER BY heartbeats DESC`,
    )
    .all(from, to) as Array<{
    agentId: string;
    heartbeats: number;
    heartbeatErrors: number;
    conversations: number;
    msSum: number;
    msCount: number;
  }>;

  // Join cost data from cost_daily
  const costRows = db
    .prepare(
      `SELECT
         agent_id AS agentId,
         SUM(cost_usd) AS costUsd
       FROM cost_daily
       WHERE date >= ? AND date <= ?
       GROUP BY agent_id`,
    )
    .all(from, to) as Array<{ agentId: string; costUsd: number }>;

  const costMap = new Map(costRows.map((r) => [r.agentId, r.costUsd]));

  const agents = analyticsRows.map((r) => ({
    agentId: r.agentId,
    heartbeats: r.heartbeats,
    errorRate:
      r.heartbeats > 0
        ? Math.round((r.heartbeatErrors / r.heartbeats) * 1000) / 1000
        : 0,
    conversations: r.conversations,
    avgResponseMs:
      r.msCount > 0 ? Math.round(r.msSum / r.msCount) : 0,
    costUsd: costMap.get(r.agentId) ?? 0,
  }));

  return c.json({ agents });
});
