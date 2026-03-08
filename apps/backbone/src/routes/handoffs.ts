import { Hono } from "hono";
import { db } from "../db/index.js";

export const handoffRoutes = new Hono();

interface HandoffRow {
  id: number;
  supervisor_id: string;
  member_id: string;
  label: string;
  trigger_intent: string;
  priority: number;
  enabled: number;
  created_at: string;
}

function formatHandoff(row: HandoffRow) {
  return {
    id: row.id,
    supervisorId: row.supervisor_id,
    memberId: row.member_id,
    label: row.label,
    triggerIntent: row.trigger_intent,
    priority: row.priority,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
  };
}

// GET /agents/:agentId/handoffs
handoffRoutes.get("/agents/:agentId/handoffs", (c) => {
  const { agentId } = c.req.param();
  const rows = db
    .prepare(
      "SELECT * FROM agent_handoffs WHERE supervisor_id = ? ORDER BY priority ASC, id ASC"
    )
    .all(agentId) as HandoffRow[];
  return c.json(rows.map(formatHandoff));
});

// POST /agents/:agentId/handoffs
handoffRoutes.post("/agents/:agentId/handoffs", async (c) => {
  const { agentId } = c.req.param();
  const body = await c.req.json();
  const { memberId, label, triggerIntent, priority = 0 } = body as {
    memberId: string;
    label: string;
    triggerIntent: string;
    priority?: number;
  };

  if (!memberId || !label || !triggerIntent) {
    return c.json({ error: "memberId, label e triggerIntent sao obrigatorios" }, 422);
  }

  try {
    const result = db
      .prepare(
        `INSERT INTO agent_handoffs (supervisor_id, member_id, label, trigger_intent, priority)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(agentId, memberId, label, triggerIntent, priority);

    const row = db
      .prepare("SELECT * FROM agent_handoffs WHERE id = ?")
      .get(result.lastInsertRowid) as HandoffRow;

    return c.json(formatHandoff(row), 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("UNIQUE constraint failed")) {
      return c.json({ error: "Handoff para esse membro ja existe neste supervisor" }, 409);
    }
    throw err;
  }
});

// PATCH /agents/:agentId/handoffs/:id
handoffRoutes.patch("/agents/:agentId/handoffs/:id", async (c) => {
  const { agentId, id } = c.req.param();
  const body = await c.req.json();

  const row = db
    .prepare("SELECT * FROM agent_handoffs WHERE id = ? AND supervisor_id = ?")
    .get(id, agentId) as HandoffRow | undefined;

  if (!row) return c.json({ error: "Handoff nao encontrado" }, 404);

  const { label, triggerIntent, priority, enabled } = body as Partial<{
    label: string;
    triggerIntent: string;
    priority: number;
    enabled: boolean;
  }>;

  db.prepare(
    `UPDATE agent_handoffs
     SET label = ?, trigger_intent = ?, priority = ?, enabled = ?
     WHERE id = ? AND supervisor_id = ?`
  ).run(
    label ?? row.label,
    triggerIntent ?? row.trigger_intent,
    priority ?? row.priority,
    enabled !== undefined ? (enabled ? 1 : 0) : row.enabled,
    id,
    agentId
  );

  const updated = db
    .prepare("SELECT * FROM agent_handoffs WHERE id = ?")
    .get(id) as HandoffRow;

  return c.json(formatHandoff(updated));
});

// DELETE /agents/:agentId/handoffs/:id
handoffRoutes.delete("/agents/:agentId/handoffs/:id", (c) => {
  const { agentId, id } = c.req.param();

  const row = db
    .prepare("SELECT id FROM agent_handoffs WHERE id = ? AND supervisor_id = ?")
    .get(id, agentId);

  if (!row) return c.json({ error: "Handoff nao encontrado" }, 404);

  db.prepare("DELETE FROM agent_handoffs WHERE id = ? AND supervisor_id = ?").run(id, agentId);

  return c.json({ ok: true });
});
