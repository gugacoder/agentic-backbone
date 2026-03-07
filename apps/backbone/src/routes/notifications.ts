import { Hono } from "hono";
import { db } from "../db/index.js";
import { eventBus } from "../events/index.js";

export const notificationRoutes = new Hono();

// ── Notifications ────────────────────────────────────────

// GET /notifications — list with filters and pagination
notificationRoutes.get("/notifications", (c) => {
  const unread = c.req.query("unread");
  const type = c.req.query("type");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10), 200);
  const offset = parseInt(c.req.query("offset") ?? "0", 10);

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (unread === "true") {
    conditions.push("read = 0");
  }
  if (type) {
    conditions.push("type = ?");
    params.push(type);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = db
    .prepare(`SELECT * FROM notifications ${where} ORDER BY ts DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as Record<string, unknown>[];

  const totalRow = db
    .prepare(`SELECT COUNT(*) as c FROM notifications ${where}`)
    .get(...params) as { c: number };

  return c.json({
    rows: rows.map(formatNotification),
    total: totalRow.c,
  });
});

// GET /notifications/count — unread count
notificationRoutes.get("/notifications/count", (c) => {
  const row = db
    .prepare("SELECT COUNT(*) as c FROM notifications WHERE read = 0")
    .get() as { c: number };
  return c.json({ unread: row.c });
});

// PATCH /notifications/:id/read — mark one as read
notificationRoutes.patch("/notifications/:id/read", (c) => {
  const { id } = c.req.param();
  const result = db.prepare("UPDATE notifications SET read = 1 WHERE id = ?").run(id);
  if (result.changes === 0) return c.json({ error: "not found" }, 404);
  return c.json({ status: "ok" });
});

// POST /notifications/read-all — mark all as read
notificationRoutes.post("/notifications/read-all", (c) => {
  db.prepare("UPDATE notifications SET read = 1 WHERE read = 0").run();
  return c.json({ status: "ok" });
});

// DELETE /notifications/:id — delete one
notificationRoutes.delete("/notifications/:id", (c) => {
  const { id } = c.req.param();
  const result = db.prepare("DELETE FROM notifications WHERE id = ?").run(id);
  if (result.changes === 0) return c.json({ error: "not found" }, 404);
  return c.json({ status: "ok" });
});

// ── Push Subscriptions ───────────────────────────────────

// POST /push/subscribe — register push subscription
notificationRoutes.post("/push/subscribe", async (c) => {
  const body = await c.req.json<{
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }>();

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return c.json({ error: "endpoint, keys.p256dh, and keys.auth are required" }, 400);
  }

  db.prepare(
    `INSERT OR REPLACE INTO push_subscriptions (endpoint, keys_p256dh, keys_auth)
     VALUES (?, ?, ?)`,
  ).run(body.endpoint, body.keys.p256dh, body.keys.auth);

  return c.json({ status: "ok" }, 201);
});

// DELETE /push/subscribe — unregister push subscription
notificationRoutes.delete("/push/subscribe", async (c) => {
  const body = await c.req.json<{ endpoint: string }>();

  if (!body.endpoint) {
    return c.json({ error: "endpoint is required" }, 400);
  }

  db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(body.endpoint);
  return c.json({ status: "ok" });
});

// ── Helper: insert + emit ────────────────────────────────

export function insertNotification(data: {
  type: string;
  severity: "info" | "warning" | "error";
  agentId?: string;
  title: string;
  body?: string;
  metadata?: Record<string, unknown>;
}): number {
  const result = db
    .prepare(
      `INSERT INTO notifications (type, severity, agent_id, title, body, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      data.type,
      data.severity,
      data.agentId ?? null,
      data.title,
      data.body ?? null,
      data.metadata ? JSON.stringify(data.metadata) : null,
    );

  const id = Number(result.lastInsertRowid);

  eventBus.emit("notification:new", {
    ts: Date.now(),
    id,
    type: data.type,
    severity: data.severity,
    agentId: data.agentId,
    title: data.title,
    body: data.body,
  });

  return id;
}

// ── Format helper ────────────────────────────────────────

function formatNotification(row: Record<string, unknown>) {
  return {
    id: row.id,
    ts: row.ts,
    type: row.type,
    severity: row.severity,
    agentId: row.agent_id ?? undefined,
    title: row.title,
    body: row.body ?? undefined,
    read: row.read === 1,
    metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
  };
}
