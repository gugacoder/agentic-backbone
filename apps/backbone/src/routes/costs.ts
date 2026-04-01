import { Hono } from "hono";
import { db } from "../db/index.js";

export const costRoutes = new Hono();

// ── GET /costs/summary ─────────────────────────────────────

costRoutes.get("/costs/summary", (c) => {
  const from = c.req.query("from") ?? new Date().toISOString().slice(0, 10);
  const to = c.req.query("to") ?? new Date().toISOString().slice(0, 10);
  const agentId = c.req.query("agent_id");

  const agentFilter = agentId ? " AND agent_id = ?" : "";
  const params: unknown[] = [from, to];
  if (agentId) params.push(agentId);

  const totals = db
    .prepare(
      `SELECT
         COALESCE(SUM(cost_usd), 0) AS totalCostUsd,
         COALESCE(SUM(tokens_in), 0) AS totalTokensIn,
         COALESCE(SUM(tokens_out), 0) AS totalTokensOut,
         COALESCE(SUM(calls), 0) AS totalCalls
       FROM cost_daily
       WHERE date >= ? AND date <= ?${agentFilter}`,
    )
    .get(...params) as {
    totalCostUsd: number;
    totalTokensIn: number;
    totalTokensOut: number;
    totalCalls: number;
  };

  const byAgent = db
    .prepare(
      `SELECT
         agent_id AS agentId,
         SUM(cost_usd) AS costUsd,
         SUM(tokens_in) AS tokensIn,
         SUM(tokens_out) AS tokensOut,
         SUM(calls) AS calls
       FROM cost_daily
       WHERE date >= ? AND date <= ?${agentFilter}
       GROUP BY agent_id
       ORDER BY costUsd DESC`,
    )
    .all(...params) as Array<{
    agentId: string;
    costUsd: number;
    tokensIn: number;
    tokensOut: number;
    calls: number;
  }>;

  const byOperation = db
    .prepare(
      `SELECT
         operation,
         SUM(cost_usd) AS costUsd,
         SUM(calls) AS calls
       FROM cost_daily
       WHERE date >= ? AND date <= ?${agentFilter}
       GROUP BY operation
       ORDER BY costUsd DESC`,
    )
    .all(...params) as Array<{
    operation: string;
    costUsd: number;
    calls: number;
  }>;

  return c.json({ ...totals, byAgent, byOperation });
});

// ── GET /costs/trend ───────────────────────────────────────

costRoutes.get("/costs/trend", (c) => {
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

  const points = db
    .prepare(
      `SELECT
         date,
         SUM(cost_usd) AS costUsd,
         SUM(tokens_in) AS tokensIn,
         SUM(tokens_out) AS tokensOut,
         SUM(calls) AS calls
       FROM cost_daily
       WHERE date >= ? AND date <= ?${agentFilter}
       GROUP BY date
       ORDER BY date ASC`,
    )
    .all(...params) as Array<{
    date: string;
    costUsd: number;
    tokensIn: number;
    tokensOut: number;
    calls: number;
  }>;

  return c.json({ points });
});

// ── Budget Alerts CRUD ─────────────────────────────────────

costRoutes.get("/budget-alerts", (c) => {
  const rows = db
    .prepare("SELECT * FROM budget_alerts ORDER BY created_at DESC")
    .all() as Array<Record<string, unknown>>;

  return c.json(rows.map(formatAlert));
});

costRoutes.post("/budget-alerts", async (c) => {
  const body = await c.req.json<{
    scope: string;
    threshold: number;
    period: string;
  }>();

  if (!body.scope || body.threshold == null || !body.period) {
    return c.json(
      { error: "scope, threshold, and period are required" },
      400,
    );
  }

  if (!["daily", "weekly", "monthly"].includes(body.period)) {
    return c.json(
      { error: "period must be daily, weekly, or monthly" },
      400,
    );
  }

  const result = db
    .prepare(
      "INSERT INTO budget_alerts (scope, threshold, period) VALUES (?, ?, ?)",
    )
    .run(body.scope, body.threshold, body.period);

  const id = Number(result.lastInsertRowid);
  const row = db
    .prepare("SELECT * FROM budget_alerts WHERE id = ?")
    .get(id) as Record<string, unknown>;

  return c.json(formatAlert(row), 201);
});

costRoutes.patch("/budget-alerts/:id", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json<{
    scope?: string;
    threshold?: number;
    period?: string;
    enabled?: boolean;
  }>();

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.scope !== undefined) {
    fields.push("scope = ?");
    values.push(body.scope);
  }
  if (body.threshold !== undefined) {
    fields.push("threshold = ?");
    values.push(body.threshold);
  }
  if (body.period !== undefined) {
    if (!["daily", "weekly", "monthly"].includes(body.period)) {
      return c.json(
        { error: "period must be daily, weekly, or monthly" },
        400,
      );
    }
    fields.push("period = ?");
    values.push(body.period);
  }
  if (body.enabled !== undefined) {
    fields.push("enabled = ?");
    values.push(body.enabled ? 1 : 0);
  }

  if (fields.length === 0) {
    return c.json({ error: "no fields to update" }, 400);
  }

  values.push(id);
  const result = db
    .prepare(`UPDATE budget_alerts SET ${fields.join(", ")} WHERE id = ?`)
    .run(...values);

  if (result.changes === 0) return c.json({ error: "not found" }, 404);

  const row = db
    .prepare("SELECT * FROM budget_alerts WHERE id = ?")
    .get(id) as Record<string, unknown>;

  return c.json(formatAlert(row));
});

costRoutes.delete("/budget-alerts/:id", (c) => {
  const { id } = c.req.param();
  const result = db
    .prepare("DELETE FROM budget_alerts WHERE id = ?")
    .run(id);

  if (result.changes === 0) return c.json({ error: "not found" }, 404);
  return c.json({ status: "ok" });
});

// ── Helpers ────────────────────────────────────────────────

function formatAlert(row: Record<string, unknown>) {
  return {
    id: row.id,
    scope: row.scope,
    threshold: row.threshold,
    period: row.period,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
  };
}
