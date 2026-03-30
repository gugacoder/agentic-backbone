import { Hono } from "hono";
import { db } from "../db/index.js";
import { getSession } from "../conversations/index.js";
import { readMessages } from "../conversations/persistence.js";

export const feedbackRoutes = new Hono();

// POST /conversations/:sessionId/messages/:messageId/feedback
feedbackRoutes.post(
  "/conversations/:sessionId/messages/:messageId/feedback",
  async (c) => {
    const { sessionId, messageId } = c.req.param();
    const payload = c.get("jwtPayload") as { sub?: string };
    const userId = payload?.sub ?? null;

    const session = getSession(sessionId);
    if (!session) return c.json({ error: "Session not found" }, 404);

    const body = await c.req.json<{ rating: "up" | "down"; reason?: string }>();
    const { rating, reason } = body;

    if (rating !== "up" && rating !== "down") {
      return c.json({ error: "rating must be 'up' or 'down'" }, 400);
    }

    const stmt = db.prepare(`
      INSERT INTO message_feedback (session_id, message_id, agent_id, rating, reason, user_id)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id, message_id) DO UPDATE SET
        rating = excluded.rating,
        reason = excluded.reason,
        user_id = excluded.user_id,
        created_at = datetime('now')
    `);
    stmt.run(sessionId, messageId, session.agent_id, rating, reason ?? null, userId);

    return c.json({ ok: true });
  }
);

// DELETE /conversations/:sessionId/messages/:messageId/feedback
feedbackRoutes.delete(
  "/conversations/:sessionId/messages/:messageId/feedback",
  (c) => {
    const { sessionId, messageId } = c.req.param();
    const stmt = db.prepare(
      `DELETE FROM message_feedback WHERE session_id = ? AND message_id = ?`
    );
    stmt.run(sessionId, messageId);
    return c.json({ ok: true });
  }
);

// GET /agents/:id/quality
feedbackRoutes.get("/agents/:id/quality", (c) => {
  const agentId = c.req.param("id");
  const days = parseInt(c.req.query("days") ?? "30", 10);

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const from = fromDate.toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);

  const totals = db
    .prepare(
      `SELECT
         COUNT(*) as totalRatings,
         SUM(CASE WHEN rating = 'up' THEN 1 ELSE 0 END) as upCount,
         SUM(CASE WHEN rating = 'down' THEN 1 ELSE 0 END) as downCount
       FROM message_feedback
       WHERE agent_id = ? AND date(created_at) >= ?`
    )
    .get(agentId, from) as { totalRatings: number; upCount: number; downCount: number };

  const approvalRate =
    totals.totalRatings > 0
      ? Math.round((totals.upCount / totals.totalRatings) * 1000) / 1000
      : 0;

  const trend = db
    .prepare(
      `SELECT
         date(created_at) as date,
         SUM(CASE WHEN rating = 'up' THEN 1 ELSE 0 END) as up,
         SUM(CASE WHEN rating = 'down' THEN 1 ELSE 0 END) as down,
         ROUND(CAST(SUM(CASE WHEN rating = 'up' THEN 1 ELSE 0 END) AS REAL) / COUNT(*), 3) as approvalRate
       FROM message_feedback
       WHERE agent_id = ? AND date(created_at) >= ?
       GROUP BY date(created_at)
       ORDER BY date ASC`
    )
    .all(agentId, from) as { date: string; up: number; down: number; approvalRate: number }[];

  const topReasons = db
    .prepare(
      `SELECT reason, COUNT(*) as count
       FROM message_feedback
       WHERE agent_id = ? AND rating = 'down' AND reason IS NOT NULL AND date(created_at) >= ?
       GROUP BY reason
       ORDER BY count DESC`
    )
    .all(agentId, from) as { reason: string; count: number }[];

  return c.json({
    agentId,
    period: { from, to },
    totalRatings: totals.totalRatings,
    upCount: totals.upCount,
    downCount: totals.downCount,
    approvalRate,
    trend,
    topReasons,
  });
});

// GET /agents/:id/quality/low-rated
feedbackRoutes.get("/agents/:id/quality/low-rated", (c) => {
  const agentId = c.req.param("id");

  const rows = db
    .prepare(
      `SELECT id, session_id, message_id, rating, reason, user_id, created_at
       FROM message_feedback
       WHERE agent_id = ? AND rating = 'down'
       ORDER BY created_at DESC
       LIMIT 100`
    )
    .all(agentId) as {
    id: number;
    session_id: string;
    message_id: string;
    rating: string;
    reason: string | null;
    user_id: string | null;
    created_at: string;
  }[];

  const result = rows.map((row) => {
    // Reconstruct input/output from messages.jsonl
    const messages = readMessages(agentId, row.session_id);
    const msgIndex = messages.findIndex((m) => m._meta?.id === row.message_id);

    const extractText = (content: string | unknown[]): string => {
      if (typeof content === "string") return content;
      return (content as any[]).filter((p: any) => p.type === "text").map((p: any) => p.text).join("");
    };

    let input = "";
    let output = "";

    if (msgIndex !== -1) {
      output = extractText(messages[msgIndex]!.content);
      // Find preceding user message
      for (let i = msgIndex - 1; i >= 0; i--) {
        if (messages[i]!.role === "user") {
          input = extractText(messages[i]!.content);
          break;
        }
      }
    }

    return {
      id: row.id,
      sessionId: row.session_id,
      messageId: row.message_id,
      reason: row.reason,
      createdAt: row.created_at,
      input,
      output,
    };
  });

  return c.json(result);
});
