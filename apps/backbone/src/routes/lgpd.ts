import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { getAuthUser } from "./auth-helpers.js";
import type { Context } from "hono";

export const lgpdRoutes = new Hono();

// ── Permission check ────────────────────────────────────────

function requireAdminOrCompliance(c: Context): Response | null {
  const payload = c.get("jwtPayload");
  const role: string = payload?.role ?? "";
  if (role !== "sysuser" && role !== "compliance") {
    return c.json({ error: "forbidden" }, 403);
  }
  return null;
}

// ── Types ───────────────────────────────────────────────────

interface DataMapRow {
  id: number;
  agent_id: string;
  data_type: string;
  label: string;
  purpose: string;
  legal_basis: string;
  retention_days: number | null;
  updated_at: string;
}

interface ConsentLogRow {
  id: number;
  agent_id: string;
  channel_id: string;
  user_ref: string;
  action: string;
  purpose: string;
  ip_address: string | null;
  recorded_at: string;
}

interface RightsRequestRow {
  id: string;
  user_ref: string;
  right_type: string;
  agent_id: string | null;
  description: string | null;
  status: string;
  response: string | null;
  requested_at: string;
  resolved_at: string | null;
}

// ── GET /lgpd/data-map ──────────────────────────────────────

lgpdRoutes.get("/lgpd/data-map", (c) => {
  const denied = requireAdminOrCompliance(c);
  if (denied) return denied;

  const rows = db.prepare("SELECT * FROM lgpd_data_map ORDER BY agent_id, data_type").all() as DataMapRow[];
  return c.json(rows);
});

// ── GET /lgpd/data-map/:agentId ─────────────────────────────

lgpdRoutes.get("/lgpd/data-map/:agentId", (c) => {
  const denied = requireAdminOrCompliance(c);
  if (denied) return denied;

  const agentId = c.req.param("agentId");
  const rows = db
    .prepare("SELECT * FROM lgpd_data_map WHERE agent_id = ? ORDER BY data_type")
    .all(agentId) as DataMapRow[];
  return c.json(rows);
});

// ── PUT /lgpd/data-map/:agentId ─────────────────────────────

lgpdRoutes.put("/lgpd/data-map/:agentId", async (c) => {
  const denied = requireAdminOrCompliance(c);
  if (denied) return denied;

  const agentId = c.req.param("agentId");
  const body = await c.req.json() as Array<{
    data_type: string;
    label: string;
    purpose: string;
    legal_basis: string;
    retention_days?: number | null;
  }>;

  if (!Array.isArray(body)) {
    return c.json({ error: "body must be an array of data map entries" }, 400);
  }

  const upsert = db.prepare(`
    INSERT INTO lgpd_data_map (agent_id, data_type, label, purpose, legal_basis, retention_days, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(agent_id, data_type) DO UPDATE SET
      label = excluded.label,
      purpose = excluded.purpose,
      legal_basis = excluded.legal_basis,
      retention_days = excluded.retention_days,
      updated_at = excluded.updated_at
  `);

  const insertMany = db.transaction((entries: typeof body) => {
    for (const entry of entries) {
      upsert.run(agentId, entry.data_type, entry.label, entry.purpose, entry.legal_basis, entry.retention_days ?? null);
    }
  });

  insertMany(body);

  const rows = db
    .prepare("SELECT * FROM lgpd_data_map WHERE agent_id = ? ORDER BY data_type")
    .all(agentId) as DataMapRow[];
  return c.json(rows);
});

// ── GET /lgpd/consent-log ───────────────────────────────────

lgpdRoutes.get("/lgpd/consent-log", (c) => {
  const denied = requireAdminOrCompliance(c);
  if (denied) return denied;

  const agentId = c.req.query("agentId");
  const userRef = c.req.query("userRef");
  const from = c.req.query("from");
  const to = c.req.query("to");

  let sql = "SELECT * FROM lgpd_consent_log WHERE 1=1";
  const params: unknown[] = [];

  if (agentId) { sql += " AND agent_id = ?"; params.push(agentId); }
  if (userRef) { sql += " AND user_ref = ?"; params.push(userRef); }
  if (from)    { sql += " AND recorded_at >= ?"; params.push(from); }
  if (to)      { sql += " AND recorded_at <= ?"; params.push(to); }

  sql += " ORDER BY recorded_at DESC LIMIT 500";

  const rows = db.prepare(sql).all(...params) as ConsentLogRow[];
  return c.json(rows);
});

// ── GET /lgpd/rights-requests ───────────────────────────────

lgpdRoutes.get("/lgpd/rights-requests", (c) => {
  const denied = requireAdminOrCompliance(c);
  if (denied) return denied;

  const status = c.req.query("status");
  const rightType = c.req.query("right_type");

  let sql = "SELECT * FROM lgpd_rights_requests WHERE 1=1";
  const params: unknown[] = [];

  if (status)    { sql += " AND status = ?"; params.push(status); }
  if (rightType) { sql += " AND right_type = ?"; params.push(rightType); }

  sql += " ORDER BY requested_at DESC";

  const rows = db.prepare(sql).all(...params) as RightsRequestRow[];
  return c.json(rows);
});

// ── POST /lgpd/rights-requests ──────────────────────────────

lgpdRoutes.post("/lgpd/rights-requests", async (c) => {
  // Public endpoint — no admin check; titulares can submit requests
  const body = await c.req.json() as {
    user_ref: string;
    right_type: string;
    agent_id?: string;
    description?: string;
  };

  if (!body.user_ref || !body.right_type) {
    return c.json({ error: "user_ref and right_type are required" }, 400);
  }

  const id = randomUUID();
  db.prepare(`
    INSERT INTO lgpd_rights_requests (id, user_ref, right_type, agent_id, description, status, requested_at)
    VALUES (?, ?, ?, ?, ?, 'open', datetime('now'))
  `).run(id, body.user_ref, body.right_type, body.agent_id ?? null, body.description ?? null);

  const row = db.prepare("SELECT * FROM lgpd_rights_requests WHERE id = ?").get(id) as RightsRequestRow;
  return c.json(row, 201);
});

// ── PATCH /lgpd/rights-requests/:id ────────────────────────

lgpdRoutes.patch("/lgpd/rights-requests/:id", async (c) => {
  const denied = requireAdminOrCompliance(c);
  if (denied) return denied;

  const id = c.req.param("id");
  const row = db.prepare("SELECT * FROM lgpd_rights_requests WHERE id = ?").get(id) as RightsRequestRow | undefined;
  if (!row) return c.json({ error: "not found" }, 404);

  const body = await c.req.json() as {
    status?: string;
    response?: string;
  };

  const closedStatuses = ["closed", "resolved", "rejected"];
  const isClosing = body.status && closedStatuses.includes(body.status) && !closedStatuses.includes(row.status);

  db.prepare(`
    UPDATE lgpd_rights_requests SET
      status = COALESCE(?, status),
      response = COALESCE(?, response),
      resolved_at = CASE WHEN ? THEN datetime('now') ELSE resolved_at END
    WHERE id = ?
  `).run(body.status ?? null, body.response ?? null, isClosing ? 1 : 0, id);

  const updated = db.prepare("SELECT * FROM lgpd_rights_requests WHERE id = ?").get(id) as RightsRequestRow;
  return c.json(updated);
});

// ── POST /lgpd/report ───────────────────────────────────────

lgpdRoutes.post("/lgpd/report", (c) => {
  const denied = requireAdminOrCompliance(c);
  if (denied) return denied;

  const dataMap = db.prepare("SELECT * FROM lgpd_data_map ORDER BY agent_id, data_type").all() as DataMapRow[];
  const rightsRequests = db.prepare("SELECT * FROM lgpd_rights_requests ORDER BY requested_at DESC").all() as RightsRequestRow[];
  const consentLog = db.prepare("SELECT * FROM lgpd_consent_log ORDER BY recorded_at DESC LIMIT 1000").all() as ConsentLogRow[];

  return c.json({
    generated_at: new Date().toISOString(),
    data_map: dataMap,
    rights_requests: rightsRequests,
    consent_log: consentLog,
  });
});
