import { Hono } from "hono";
import { db } from "../db/index.js";

export const securityRoutes = new Hono();

// GET /security/events
securityRoutes.get("/security/events", (c) => {
  const { agent_id, severity, action, from, to } = c.req.query();
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10), 200);
  const offset = parseInt(c.req.query("offset") ?? "0", 10);

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (agent_id) { conditions.push("agent_id = ?"); params.push(agent_id); }
  if (severity) { conditions.push("severity = ?"); params.push(severity); }
  if (action) { conditions.push("action = ?"); params.push(action); }
  if (from) { conditions.push("created_at >= ?"); params.push(from); }
  if (to) { conditions.push("created_at <= ?"); params.push(to); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const total = (
    db.prepare(`SELECT COUNT(*) as count FROM security_events ${where}`).get(...params) as { count: number }
  ).count;

  const events = db
    .prepare(
      `SELECT id, agent_id, session_id, event_type, action, severity, pattern_matched, score, input_excerpt, input_hash, created_at
       FROM security_events ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  return c.json({ events, total, limit, offset });
});

// GET /security/summary
securityRoutes.get("/security/summary", (c) => {
  const days = parseInt(c.req.query("days") ?? "7", 10);
  const from = new Date();
  from.setDate(from.getDate() - days);
  const fromStr = from.toISOString();

  const totalEvents = (
    db.prepare(`SELECT COUNT(*) as count FROM security_events WHERE created_at >= ?`).get(fromStr) as { count: number }
  ).count;

  const byAction = db
    .prepare(`SELECT action, COUNT(*) as count FROM security_events WHERE created_at >= ? GROUP BY action`)
    .all(fromStr) as { action: string; count: number }[];

  const bySeverity = db
    .prepare(`SELECT severity, COUNT(*) as count FROM security_events WHERE created_at >= ? GROUP BY severity`)
    .all(fromStr) as { severity: string; count: number }[];

  const byAgent = db
    .prepare(`SELECT agent_id, COUNT(*) as count FROM security_events WHERE created_at >= ? GROUP BY agent_id ORDER BY count DESC LIMIT 10`)
    .all(fromStr) as { agent_id: string; count: number }[];

  const trend = db
    .prepare(
      `SELECT date(created_at) as date,
              SUM(CASE WHEN action = 'blocked' THEN 1 ELSE 0 END) as blocked,
              SUM(CASE WHEN action = 'flagged' THEN 1 ELSE 0 END) as flagged,
              COUNT(*) as total
       FROM security_events
       WHERE created_at >= ?
       GROUP BY date(created_at)
       ORDER BY date ASC`
    )
    .all(fromStr) as { date: string; blocked: number; flagged: number; total: number }[];

  return c.json({ totalEvents, byAction, bySeverity, byAgent, trend });
});

// GET /security/rules
securityRoutes.get("/security/rules", (c) => {
  const rules = db
    .prepare(`SELECT id, name, description, pattern, rule_type, severity, action, is_system, enabled, created_at FROM security_rules ORDER BY is_system DESC, id ASC`)
    .all();
  return c.json(rules);
});

// POST /security/rules
securityRoutes.post("/security/rules", async (c) => {
  const body = await c.req.json<{
    name: string;
    description?: string;
    pattern: string | string[];
    rule_type: string;
    severity: string;
    action: string;
  }>();

  const pattern = Array.isArray(body.pattern) ? JSON.stringify(body.pattern) : body.pattern;

  const result = db
    .prepare(
      `INSERT INTO security_rules (name, description, pattern, rule_type, severity, action, is_system, enabled)
       VALUES (?, ?, ?, ?, ?, ?, 0, 1)`
    )
    .run(
      body.name,
      body.description ?? null,
      pattern,
      body.rule_type,
      body.severity,
      body.action
    );

  const rule = db.prepare(`SELECT * FROM security_rules WHERE id = ?`).get(result.lastInsertRowid);
  return c.json(rule, 201);
});

// PATCH /security/rules/:id
securityRoutes.patch("/security/rules/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const rule = db.prepare(`SELECT * FROM security_rules WHERE id = ?`).get(id) as {
    is_system: number;
    [key: string]: unknown;
  } | undefined;

  if (!rule) return c.json({ error: "Rule not found" }, 404);

  const body = await c.req.json<Record<string, unknown>>();

  if (rule.is_system) {
    // System rules only allow toggling enabled
    if (!("enabled" in body)) {
      return c.json({ error: "Only 'enabled' can be updated on system rules" }, 400);
    }
    db.prepare(`UPDATE security_rules SET enabled = ? WHERE id = ?`).run(body.enabled ? 1 : 0, id);
  } else {
    const fields: string[] = [];
    const params: unknown[] = [];

    for (const key of ["name", "description", "pattern", "rule_type", "severity", "action", "enabled"] as const) {
      if (key in body) {
        fields.push(`${key} = ?`);
        const val = body[key];
        params.push(key === "pattern" && Array.isArray(val) ? JSON.stringify(val) : val);
      }
    }

    if (fields.length === 0) return c.json({ error: "No valid fields to update" }, 400);
    params.push(id);
    db.prepare(`UPDATE security_rules SET ${fields.join(", ")} WHERE id = ?`).run(...params);
  }

  const updated = db.prepare(`SELECT * FROM security_rules WHERE id = ?`).get(id);
  return c.json(updated);
});

// DELETE /security/rules/:id
securityRoutes.delete("/security/rules/:id", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const rule = db.prepare(`SELECT is_system FROM security_rules WHERE id = ?`).get(id) as { is_system: number } | undefined;

  if (!rule) return c.json({ error: "Rule not found" }, 404);
  if (rule.is_system) return c.json({ error: "Cannot delete system rules" }, 403);

  db.prepare(`DELETE FROM security_rules WHERE id = ?`).run(id);
  return c.json({ ok: true });
});
