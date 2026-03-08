import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../db/index.js";
import { getSession } from "../conversations/index.js";
import { readMessages } from "../conversations/persistence.js";
import { agentDir } from "../context/paths.js";

export const ratingRoutes = new Hono();

// ── POST /conversations/:sessionId/messages/:index/rate ─────────────────────

ratingRoutes.post(
  "/conversations/:sessionId/messages/:index/rate",
  async (c) => {
    const { sessionId, index } = c.req.param();
    const messageIndex = parseInt(index, 10);

    if (isNaN(messageIndex) || messageIndex < 0) {
      return c.json({ error: "index must be a non-negative integer" }, 400);
    }

    const session = getSession(sessionId);
    if (!session) return c.json({ error: "Session not found" }, 404);

    const messages = readMessages(session.agent_id, sessionId);
    const msg = messages[messageIndex];
    if (!msg) {
      return c.json({ error: `No message at index ${messageIndex}` }, 404);
    }
    if (msg.role !== "assistant") {
      return c.json(
        { error: "Only assistant messages can be rated" },
        400
      );
    }

    const body = await c.req.json<{
      rating: "up" | "down";
      reason?: string;
      reasonCategory?: string;
      userRef?: string;
    }>();

    if (body.rating !== "up" && body.rating !== "down") {
      return c.json({ error: "rating must be 'up' or 'down'" }, 400);
    }

    const validCategories = ["wrong_info", "off_topic", "too_long", "rude", "other"];
    if (body.reasonCategory && !validCategories.includes(body.reasonCategory)) {
      return c.json(
        { error: `reasonCategory must be one of: ${validCategories.join(", ")}` },
        400
      );
    }

    const payload = c.get("jwtPayload") as { sub?: string } | undefined;
    const userRef = body.userRef ?? payload?.sub ?? null;
    const channelType = session.channel_id ?? "web";
    const id = `rat_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

    db.prepare(`
      INSERT INTO message_ratings
        (id, session_id, message_index, agent_id, channel_type, rating, reason, reason_cat, user_ref)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id, message_index) DO UPDATE SET
        rating       = excluded.rating,
        reason       = excluded.reason,
        reason_cat   = excluded.reason_cat,
        user_ref     = excluded.user_ref,
        rated_at     = datetime('now')
    `).run(
      id,
      sessionId,
      messageIndex,
      session.agent_id,
      channelType,
      body.rating,
      body.reason ?? null,
      body.reasonCategory ?? null,
      userRef,
    );

    const saved = db
      .prepare("SELECT * FROM message_ratings WHERE session_id = ? AND message_index = ?")
      .get(sessionId, messageIndex) as {
        id: string;
        session_id: string;
        message_index: number;
        agent_id: string;
        rating: string;
        rated_at: string;
      };

    return c.json(
      {
        id: saved.id,
        sessionId: saved.session_id,
        messageIndex: saved.message_index,
        agentId: saved.agent_id,
        rating: saved.rating,
        ratedAt: saved.rated_at,
      },
      201
    );
  }
);

// ── GET /agents/:agentId/ratings ────────────────────────────────────────────

ratingRoutes.get("/agents/:agentId/ratings", (c) => {
  const agentId = c.req.param("agentId");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10), 200);
  const offset = parseInt(c.req.query("offset") ?? "0", 10);
  const from = c.req.query("from");
  const to = c.req.query("to");
  const channelType = c.req.query("channelType");
  const ratingFilter = c.req.query("rating");

  const conditions: string[] = ["agent_id = ?"];
  const params: (string | number)[] = [agentId];

  if (from) { conditions.push("date(rated_at) >= ?"); params.push(from); }
  if (to)   { conditions.push("date(rated_at) <= ?"); params.push(to); }
  if (channelType) { conditions.push("channel_type = ?"); params.push(channelType); }
  if (ratingFilter === "up" || ratingFilter === "down") {
    conditions.push("rating = ?");
    params.push(ratingFilter);
  }

  const where = conditions.join(" AND ");

  const total = (
    db.prepare(`SELECT COUNT(*) as n FROM message_ratings WHERE ${where}`).get(...params) as { n: number }
  ).n;

  const rows = db
    .prepare(
      `SELECT id, session_id, message_index, agent_id, channel_type, rating, reason, reason_cat, user_ref, rated_at
       FROM message_ratings WHERE ${where}
       ORDER BY rated_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  return c.json({ total, limit, offset, items: rows });
});

// ── GET /agents/:agentId/ratings/summary ────────────────────────────────────

ratingRoutes.get("/agents/:agentId/ratings/summary", (c) => {
  const agentId = c.req.param("agentId");
  const from = c.req.query("from") ?? new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const to   = c.req.query("to")   ?? new Date().toISOString().slice(0, 10);
  const channelType = c.req.query("channelType");

  const baseConditions: string[] = [
    "agent_id = ?",
    "date(rated_at) >= ?",
    "date(rated_at) <= ?",
  ];
  const baseParams: (string | number)[] = [agentId, from, to];

  if (channelType) {
    baseConditions.push("channel_type = ?");
    baseParams.push(channelType);
  }

  const where = baseConditions.join(" AND ");

  const totals = db
    .prepare(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN rating = 'up' THEN 1 ELSE 0 END) as upCount,
         SUM(CASE WHEN rating = 'down' THEN 1 ELSE 0 END) as downCount
       FROM message_ratings WHERE ${where}`
    )
    .get(...baseParams) as { total: number; upCount: number; downCount: number };

  const approvalRate =
    totals.total > 0
      ? Math.round((totals.upCount / totals.total) * 1000) / 1000
      : 0;

  // breakdown by reason_cat (down ratings only)
  const catRows = db
    .prepare(
      `SELECT reason_cat, COUNT(*) as cnt
       FROM message_ratings
       WHERE ${where} AND rating = 'down' AND reason_cat IS NOT NULL
       GROUP BY reason_cat`
    )
    .all(...baseParams) as { reason_cat: string; cnt: number }[];

  const byCategory: Record<string, number> = {};
  for (const r of catRows) byCategory[r.reason_cat] = r.cnt;

  // breakdown by channel
  const channelRows = db
    .prepare(
      `SELECT
         channel_type,
         COUNT(*) as total,
         SUM(CASE WHEN rating = 'up' THEN 1 ELSE 0 END) as upCount
       FROM message_ratings WHERE ${where}
       GROUP BY channel_type`
    )
    .all(...baseParams) as { channel_type: string; total: number; upCount: number }[];

  const byChannel: Record<string, { total: number; approvalRate: number }> = {};
  for (const r of channelRows) {
    byChannel[r.channel_type] = {
      total: r.total,
      approvalRate: r.total > 0 ? Math.round((r.upCount / r.total) * 1000) / 1000 : 0,
    };
  }

  // daily trend
  const trend = db
    .prepare(
      `SELECT
         date(rated_at) as date,
         COUNT(*) as total,
         ROUND(CAST(SUM(CASE WHEN rating = 'up' THEN 1 ELSE 0 END) AS REAL) / COUNT(*), 3) as approvalRate
       FROM message_ratings WHERE ${where}
       GROUP BY date(rated_at)
       ORDER BY date ASC`
    )
    .all(...baseParams) as { date: string; total: number; approvalRate: number }[];

  return c.json({
    agentId,
    period: { from, to },
    total: totals.total,
    approvalRate,
    upCount: totals.upCount,
    downCount: totals.downCount,
    byCategory,
    byChannel,
    trend,
  });
});

// ── POST /agents/:agentId/ratings/export-golden-set ─────────────────────────

ratingRoutes.post("/agents/:agentId/ratings/export-golden-set", async (c) => {
  const agentId = c.req.param("agentId");

  const body = await c.req.json<{
    rating?: "up" | "down";
    from?: string;
    to?: string;
    limit?: number;
  }>();

  const rating = body.rating ?? "down";
  const limit = Math.min(body.limit ?? 100, 500);
  const from = body.from;
  const to   = body.to;

  const conditions: string[] = ["agent_id = ?", "rating = ?"];
  const params: (string | number)[] = [agentId, rating];

  if (from) { conditions.push("rated_at >= ?"); params.push(from); }
  if (to)   { conditions.push("rated_at <= ?"); params.push(to); }

  const rows = db
    .prepare(
      `SELECT session_id, message_index, reason, reason_cat, rated_at
       FROM message_ratings WHERE ${conditions.join(" AND ")}
       ORDER BY rated_at DESC LIMIT ?`
    )
    .all(...params, limit) as {
      session_id: string;
      message_index: number;
      reason: string | null;
      reason_cat: string | null;
      rated_at: string;
    }[];

  const today = new Date().toISOString().slice(0, 10);
  const evalSetId = `golden-from-ratings-${today}`;
  const evalDir = join(agentDir(agentId), "evals", evalSetId);
  mkdirSync(evalDir, { recursive: true });

  const cases: { input: string; output: string; tags: string[]; ratedAt: string }[] = [];

  for (const row of rows) {
    const messages = readMessages(agentId, row.session_id);
    const msg = messages[row.message_index];
    if (!msg || msg.role !== "assistant") continue;

    let input = "";
    for (let i = row.message_index - 1; i >= 0; i--) {
      if (messages[i]!.role === "user") {
        input = messages[i]!.content;
        break;
      }
    }

    const tags: string[] = [];
    if (row.reason_cat) tags.push(row.reason_cat);

    cases.push({
      input,
      output: msg.content,
      tags,
      ratedAt: row.rated_at,
    });
  }

  // Write cases.jsonl
  const jsonlPath = join(evalDir, "cases.jsonl");
  writeFileSync(
    jsonlPath,
    cases.map((c) => JSON.stringify(c)).join("\n") + "\n"
  );

  // Write metadata
  writeFileSync(
    join(evalDir, "meta.json"),
    JSON.stringify(
      {
        evalSetId,
        agentId,
        exportedAt: new Date().toISOString(),
        sourceRating: rating,
        from: from ?? null,
        to: to ?? null,
        casesTotal: cases.length,
      },
      null,
      2
    ) + "\n"
  );

  const relativePath = `context/agents/${agentId}/evals/${evalSetId}/`;

  return c.json(
    {
      evalSetId,
      casesExported: cases.length,
      path: relativePath,
    },
    201
  );
});

// ── GET /ratings — global dashboard ─────────────────────────────────────────

ratingRoutes.get("/ratings", (c) => {
  const from = c.req.query("from") ?? new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const to   = c.req.query("to")   ?? new Date().toISOString().slice(0, 10);
  const channelType = c.req.query("channelType");

  const conditions: string[] = ["date(rated_at) >= ?", "date(rated_at) <= ?"];
  const params: (string | number)[] = [from, to];

  if (channelType) {
    conditions.push("channel_type = ?");
    params.push(channelType);
  }

  const where = conditions.join(" AND ");

  const agentRows = db
    .prepare(
      `SELECT
         agent_id,
         COUNT(*) as total,
         SUM(CASE WHEN rating = 'up' THEN 1 ELSE 0 END) as upCount,
         SUM(CASE WHEN rating = 'down' THEN 1 ELSE 0 END) as downCount,
         MAX(rated_at) as lastRatedAt
       FROM message_ratings WHERE ${where}
       GROUP BY agent_id
       ORDER BY total DESC`
    )
    .all(...params) as {
      agent_id: string;
      total: number;
      upCount: number;
      downCount: number;
      lastRatedAt: string;
    }[];

  // Compute trend direction: compare last 7 days vs prior 7 days approval rate
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);

  const agents = agentRows.map((row) => {
    const approvalRate =
      row.total > 0 ? Math.round((row.upCount / row.total) * 1000) / 1000 : 0;

    const recent = db
      .prepare(
        `SELECT
           SUM(CASE WHEN rating = 'up' THEN 1 ELSE 0 END) as up,
           COUNT(*) as n
         FROM message_ratings
         WHERE agent_id = ? AND date(rated_at) >= ?`
      )
      .get(row.agent_id, sevenDaysAgo) as { up: number; n: number };

    const prior = db
      .prepare(
        `SELECT
           SUM(CASE WHEN rating = 'up' THEN 1 ELSE 0 END) as up,
           COUNT(*) as n
         FROM message_ratings
         WHERE agent_id = ? AND date(rated_at) >= ? AND date(rated_at) < ?`
      )
      .get(row.agent_id, fourteenDaysAgo, sevenDaysAgo) as { up: number; n: number };

    const recentRate = recent.n > 0 ? recent.up / recent.n : null;
    const priorRate  = prior.n  > 0 ? prior.up  / prior.n  : null;

    let trend: "up" | "down" | "stable" = "stable";
    if (recentRate !== null && priorRate !== null) {
      if (recentRate > priorRate + 0.05) trend = "up";
      else if (recentRate < priorRate - 0.05) trend = "down";
    }

    const alert = approvalRate < 0.7 && recent.n > 0;

    return {
      agentId: row.agent_id,
      total: row.total,
      upCount: row.upCount,
      downCount: row.downCount,
      approvalRate,
      trend,
      alert,
      lastRatedAt: row.lastRatedAt,
    };
  });

  const globalTotal = agentRows.reduce((s, r) => s + r.total, 0);
  const globalUp    = agentRows.reduce((s, r) => s + r.upCount, 0);

  return c.json({
    period: { from, to },
    globalTotal,
    globalApprovalRate: globalTotal > 0 ? Math.round((globalUp / globalTotal) * 1000) / 1000 : 0,
    agents,
  });
});
