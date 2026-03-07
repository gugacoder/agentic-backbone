import { Hono } from "hono";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { db } from "../db/index.js";
import { runAgent } from "../agent/index.js";
import { assemblePrompt } from "../context/index.js";
import { getAgent } from "../agents/registry.js";

export const webhookRoutes = new Hono();

// ── Helpers ────────────────────────────────────────────────

function maskSecret(secret: string): string {
  return secret.slice(0, 4) + "****";
}

interface WebhookRow {
  id: string;
  agent_id: string;
  name: string;
  secret: string;
  enabled: number;
  description: string | null;
  filters: string | null;
  created_at: string;
  updated_at: string;
}

interface WebhookEventRow {
  id: string;
  webhook_id: string;
  agent_id: string;
  received_at: string;
  headers: string;
  payload: string;
  status: string;
  error: string | null;
  processed_at: string | null;
}

function formatWebhook(row: WebhookRow, includeSecret = false) {
  return {
    id: row.id,
    agentId: row.agent_id,
    name: row.name,
    secret: includeSecret ? row.secret : maskSecret(row.secret),
    enabled: row.enabled === 1,
    description: row.description,
    filters: row.filters ? JSON.parse(row.filters) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatEvent(row: WebhookEventRow) {
  return {
    id: row.id,
    webhookId: row.webhook_id,
    agentId: row.agent_id,
    receivedAt: row.received_at,
    headers: JSON.parse(row.headers),
    payload: JSON.parse(row.payload),
    status: row.status,
    error: row.error,
    processedAt: row.processed_at,
  };
}

// ── Authenticated CRUD routes ──────────────────────────────

// GET /agents/:agentId/webhooks
webhookRoutes.get("/agents/:agentId/webhooks", (c) => {
  const { agentId } = c.req.param();
  const rows = db
    .prepare("SELECT * FROM webhooks WHERE agent_id = ? ORDER BY created_at DESC")
    .all(agentId) as WebhookRow[];

  return c.json(rows.map((r) => formatWebhook(r)));
});

// POST /agents/:agentId/webhooks
webhookRoutes.post("/agents/:agentId/webhooks", async (c) => {
  const { agentId } = c.req.param();
  const body = await c.req.json<{ name: string; description?: string; filters?: string[] }>();

  if (!body.name) return c.json({ error: "name is required" }, 400);

  const id = randomUUID();
  const secret = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  const filters = body.filters ? JSON.stringify(body.filters) : null;

  db.prepare(
    `INSERT INTO webhooks (id, agent_id, name, secret, enabled, description, filters)
     VALUES (?, ?, ?, ?, 1, ?, ?)`
  ).run(id, agentId, body.name, secret, body.description ?? null, filters);

  const row = db.prepare("SELECT * FROM webhooks WHERE id = ?").get(id) as WebhookRow;

  // Return secret only on creation
  return c.json({ ...formatWebhook(row), secret }, 201);
});

// PATCH /agents/:agentId/webhooks/:webhookId
webhookRoutes.patch("/agents/:agentId/webhooks/:webhookId", async (c) => {
  const { agentId, webhookId } = c.req.param();
  const row = db
    .prepare("SELECT * FROM webhooks WHERE id = ? AND agent_id = ?")
    .get(webhookId, agentId) as WebhookRow | undefined;

  if (!row) return c.json({ error: "not found" }, 404);

  const body = await c.req.json<{ name?: string; description?: string; filters?: string[]; enabled?: boolean }>();

  const name = body.name ?? row.name;
  const description = body.description !== undefined ? body.description : row.description;
  const filters = body.filters !== undefined ? JSON.stringify(body.filters) : row.filters;
  const enabled = body.enabled !== undefined ? (body.enabled ? 1 : 0) : row.enabled;

  db.prepare(
    `UPDATE webhooks SET name = ?, description = ?, filters = ?, enabled = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(name, description, filters, enabled, webhookId);

  const updated = db.prepare("SELECT * FROM webhooks WHERE id = ?").get(webhookId) as WebhookRow;
  return c.json(formatWebhook(updated));
});

// DELETE /agents/:agentId/webhooks/:webhookId
webhookRoutes.delete("/agents/:agentId/webhooks/:webhookId", (c) => {
  const { agentId, webhookId } = c.req.param();
  const row = db
    .prepare("SELECT id FROM webhooks WHERE id = ? AND agent_id = ?")
    .get(webhookId, agentId);

  if (!row) return c.json({ error: "not found" }, 404);

  db.prepare("DELETE FROM webhooks WHERE id = ?").run(webhookId);
  return c.json({ ok: true });
});

// GET /agents/:agentId/webhooks/:webhookId/events
webhookRoutes.get("/agents/:agentId/webhooks/:webhookId/events", (c) => {
  const { agentId, webhookId } = c.req.param();
  const page = parseInt(c.req.query("page") ?? "1", 10);
  const limit = 50;
  const offset = (page - 1) * limit;

  const rows = db
    .prepare(
      `SELECT * FROM webhook_events WHERE webhook_id = ? AND agent_id = ?
       ORDER BY received_at DESC LIMIT ? OFFSET ?`
    )
    .all(webhookId, agentId, limit, offset) as WebhookEventRow[];

  return c.json(rows.map(formatEvent));
});

// POST /agents/:agentId/webhooks/:webhookId/events/:eventId/reprocess
webhookRoutes.post("/agents/:agentId/webhooks/:webhookId/events/:eventId/reprocess", (c) => {
  const { agentId, webhookId, eventId } = c.req.param();

  const event = db
    .prepare("SELECT * FROM webhook_events WHERE id = ? AND webhook_id = ? AND agent_id = ?")
    .get(eventId, webhookId, agentId) as WebhookEventRow | undefined;

  if (!event) return c.json({ error: "not found" }, 404);

  // Reset to pending and re-trigger
  db.prepare(
    `UPDATE webhook_events SET status = 'pending', error = NULL, processed_at = NULL WHERE id = ?`
  ).run(eventId);

  const payload = JSON.parse(event.payload);
  executeWebhookAsync(eventId, agentId, payload).catch((err) => {
    console.error(`[webhook] reprocess error for event ${eventId}:`, err);
  });

  return c.json({ eventId });
});

// ── Async agent execution ───────────────────────────────────

async function executeWebhookAsync(eventId: string, agentId: string, payload: unknown): Promise<void> {
  const agent = getAgent(agentId);
  if (!agent) {
    db.prepare(
      `UPDATE webhook_events SET status = 'failed', error = ?, processed_at = datetime('now') WHERE id = ?`
    ).run(`Agent ${agentId} not found`, eventId);
    return;
  }

  const prompt = `<webhook_event>${JSON.stringify(payload)}</webhook_event>`;

  try {
    // Try conversation mode; if no instructions, run with bare prompt
    const assembled = await assemblePrompt(agentId, "conversation", { userMessage: prompt });

    const runOptions = assembled
      ? { role: "webhook" as const, system: assembled.system }
      : { role: "webhook" as const };

    // Consume the async generator to drive execution to completion
    for await (const _event of runAgent(assembled ? assembled.userMessage : prompt, runOptions)) {
      // fire-and-forget: consume events but do nothing with them
    }

    db.prepare(
      `UPDATE webhook_events SET status = 'done', processed_at = datetime('now') WHERE id = ?`
    ).run(eventId);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    db.prepare(
      `UPDATE webhook_events SET status = 'failed', error = ?, processed_at = datetime('now') WHERE id = ?`
    ).run(error, eventId);
  }
}

// ── Public endpoint with HMAC-SHA256 validation ────────────

// POST /webhooks/:agentId/:webhookId
webhookRoutes.post("/webhooks/:agentId/:webhookId", async (c) => {
  const { agentId, webhookId } = c.req.param();

  const webhook = db
    .prepare("SELECT * FROM webhooks WHERE id = ? AND agent_id = ?")
    .get(webhookId, agentId) as WebhookRow | undefined;

  if (!webhook || webhook.enabled === 0) {
    return c.json({ error: "not found" }, 404);
  }

  // HMAC-SHA256 validation
  const signature = c.req.header("X-Signature-256") ?? "";
  const rawBody = await c.req.text();

  const expected = "sha256=" + createHmac("sha256", webhook.secret).update(rawBody).digest("hex");

  let signatureValid = false;
  try {
    const expectedBuf = Buffer.from(expected, "utf8");
    const signatureBuf = Buffer.from(signature, "utf8");
    signatureValid =
      expectedBuf.length === signatureBuf.length &&
      timingSafeEqual(expectedBuf, signatureBuf);
  } catch {
    signatureValid = false;
  }

  if (!signatureValid) {
    return c.json({ error: "invalid signature" }, 401);
  }

  // Event type filter
  const eventType = c.req.header("X-Event-Type");
  if (webhook.filters) {
    const allowed: string[] = JSON.parse(webhook.filters);
    if (allowed.length > 0 && eventType && !allowed.includes(eventType)) {
      return c.json({ error: "event type not allowed" }, 422);
    }
  }

  // Parse payload
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    payload = rawBody;
  }

  // Record event headers
  const headersObj: Record<string, string> = {};
  for (const [k, v] of Object.entries(c.req.header())) {
    if (typeof v === "string") headersObj[k] = v;
  }

  const eventId = randomUUID();
  db.prepare(
    `INSERT INTO webhook_events (id, webhook_id, agent_id, headers, payload, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`
  ).run(eventId, webhookId, agentId, JSON.stringify(headersObj), JSON.stringify(payload));

  // Fire-and-forget: execute agent asynchronously without blocking the HTTP response
  executeWebhookAsync(eventId, agentId, payload).catch((err) => {
    console.error(`[webhook] unhandled error for event ${eventId}:`, err);
  });

  return c.json({ eventId });
});
