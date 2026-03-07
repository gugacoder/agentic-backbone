import { Hono } from "hono";
import { db } from "../db/index.js";

export const approvalRoutes = new Hono();

approvalRoutes.get("/approval-requests", (c) => {
  const status = c.req.query("status");
  const agentId = c.req.query("agent_id");

  let sql = "SELECT * FROM approval_requests WHERE 1=1";
  const params: string[] = [];

  if (status) {
    const statuses = status.split(",").map((s) => s.trim());
    sql += ` AND status IN (${statuses.map(() => "?").join(",")})`;
    params.push(...statuses);
  }
  if (agentId) {
    sql += " AND agent_id = ?";
    params.push(agentId);
  }

  sql += " ORDER BY created_at DESC";

  const rows = db.prepare(sql).all(...params);
  return c.json(rows);
});

approvalRoutes.get("/approval-requests/:id", (c) => {
  const id = c.req.param("id");
  const row = db.prepare("SELECT * FROM approval_requests WHERE id = ?").get(id);
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(row);
});

approvalRoutes.post("/approval-requests/:id/approve", (c) => {
  const id = c.req.param("id");
  const payload = c.get("jwtPayload") as { sub?: string; username?: string } | undefined;
  const decidedBy = (payload?.sub ?? payload?.username ?? "unknown") as string;

  const row = db.prepare("SELECT * FROM approval_requests WHERE id = ?").get(id) as
    | { status: string }
    | undefined;
  if (!row) return c.json({ error: "not found" }, 404);
  if (row.status !== "pending") return c.json({ error: "request is not pending" }, 409);

  db.prepare(
    "UPDATE approval_requests SET status = 'approved', decided_by = ?, decided_at = datetime('now') WHERE id = ?"
  ).run(decidedBy, id);

  return c.json({ ok: true });
});

approvalRoutes.post("/approval-requests/:id/reject", async (c) => {
  const id = c.req.param("id");
  const payload = c.get("jwtPayload") as { sub?: string; username?: string } | undefined;
  const decidedBy = (payload?.sub ?? payload?.username ?? "unknown") as string;

  const row = db.prepare("SELECT * FROM approval_requests WHERE id = ?").get(id) as
    | { status: string }
    | undefined;
  if (!row) return c.json({ error: "not found" }, 404);
  if (row.status !== "pending") return c.json({ error: "request is not pending" }, 409);

  const body = await c.req.json().catch(() => ({})) as { reason?: string };
  const reason = body.reason ?? null;

  db.prepare(
    "UPDATE approval_requests SET status = 'rejected', decided_by = ?, decided_at = datetime('now'), payload = json_patch(payload, json_object('rejection_reason', ?)) WHERE id = ?"
  ).run(decidedBy, reason, id);

  return c.json({ ok: true });
});

// Background job: expire pending requests past their expires_at
function expireStaleApprovals() {
  db.prepare(
    "UPDATE approval_requests SET status = 'expired' WHERE status = 'pending' AND expires_at < datetime('now')"
  ).run();
}

// Run immediately and then every minute
expireStaleApprovals();
setInterval(expireStaleApprovals, 60_000);
