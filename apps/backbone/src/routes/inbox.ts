import { Hono } from "hono";
import { db } from "../db/index.js";
import { readMessages } from "../conversations/persistence.js";
import { getChannel } from "../channels/registry.js";
import { listAgents } from "../agents/registry.js";

export const inboxRoutes = new Hono();

interface SessionRow {
  session_id: string;
  user_id: string;
  agent_id: string | null;
  channel_id: string | null;
  takeover_by: string | null;
  takeover_at: string | null;
  created_at: string;
  updated_at: string;
  title: string | null;
}

function getChannelType(channelId: string | null): string {
  if (!channelId) return "web";
  const ch = getChannel(channelId);
  return ch?.type ?? "web";
}

function computeStatus(
  session: SessionRow,
  lastMessage: { role: string; _meta?: { ts?: string } } | null
): "operator" | "waiting" | "agent" {
  if (session.takeover_by) return "operator";
  if (lastMessage && lastMessage.role === "user") {
    const ts = lastMessage._meta?.ts;
    if (ts) {
      const lastTs = new Date(ts).getTime();
      const fiveMinMs = 5 * 60 * 1000;
      if (Date.now() - lastTs > fiveMinMs) return "waiting";
    }
  }
  return "agent";
}

// GET /inbox
inboxRoutes.get("/inbox", (c) => {
  const { channel, agent_id, status } = c.req.query();
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10), 200);
  const offset = parseInt(c.req.query("offset") ?? "0", 10);

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (agent_id) {
    conditions.push("agent_id = ?");
    params.push(agent_id);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const allSessions = db
    .prepare(
      `SELECT session_id, user_id, agent_id, channel_id, takeover_by, takeover_at, created_at, updated_at, title
       FROM sessions ${where}
       ORDER BY updated_at DESC`
    )
    .all(...params) as SessionRow[];

  const agents = listAgents();
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  const enriched = allSessions
    .map((s) => {
      const channelType = getChannelType(s.channel_id);
      const messages = readMessages(s.agent_id ?? "system.main", s.session_id);
      const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
      const computedStatus = computeStatus(s, lastMsg);
      const agentConfig = agentMap.get(s.agent_id ?? "system.main");

      return {
        sessionId: s.session_id,
        agentId: s.agent_id ?? "system.main",
        agentLabel: (agentConfig?.metadata?.["name"] as string | undefined) ?? (agentConfig?.slug ?? s.agent_id ?? "system.main"),
        channelType,
        channelId: s.channel_id,
        status: computedStatus,
        lastMessage: lastMsg
          ? {
              role: lastMsg.role,
              content: typeof lastMsg.content === "string"
                ? lastMsg.content
                : (lastMsg.content as any[]).filter((p: any) => p.type === "text").map((p: any) => p.text).join(""),
              timestamp: lastMsg._meta?.ts ?? "",
            }
          : null,
        waitingSince: computedStatus === "waiting" && lastMsg ? lastMsg._meta?.ts ?? "" : null,
        operatorId: s.takeover_by ?? null,
        startedAt: s.created_at,
        messageCount: messages.length,
      };
    })
    .filter((s) => {
      if (channel && s.channelType !== channel) return false;
      if (status && s.status !== status) return false;
      return true;
    });

  const total = enriched.length;
  const page = enriched.slice(offset, offset + limit);

  return c.json({ sessions: page, total, offset, limit });
});

// GET /inbox/metrics
inboxRoutes.get("/inbox/metrics", (c) => {
  const allSessions = db
    .prepare(
      `SELECT session_id, agent_id, channel_id, takeover_by, created_at, updated_at
       FROM sessions
       ORDER BY updated_at DESC`
    )
    .all() as SessionRow[];

  const byChannelMap = new Map<string, number>();
  const byStatusMap: Record<string, number> = { agent: 0, operator: 0, waiting: 0 };

  for (const s of allSessions) {
    const channelType = getChannelType(s.channel_id);
    byChannelMap.set(channelType, (byChannelMap.get(channelType) ?? 0) + 1);

    const messages = readMessages(s.agent_id ?? "system.main", s.session_id);
    const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
    const computedStatus = computeStatus(s, lastMsg);
    byStatusMap[computedStatus] = (byStatusMap[computedStatus] ?? 0) + 1;
  }

  // avgResponseMs from analytics_daily aggregated per channel type would need a join
  // We approximate: use analytics response_ms_sum/count grouped by agent, then map agent->channel
  const analyticsRows = db
    .prepare(
      `SELECT agent_id, SUM(response_ms_sum) as total_ms, SUM(response_ms_count) as total_count
       FROM analytics_daily
       WHERE date >= date('now', '-7 days')
       GROUP BY agent_id`
    )
    .all() as { agent_id: string; total_ms: number; total_count: number }[];

  // Map agent -> channel type (based on sessions)
  const agentChannelMap = new Map<string, string>();
  for (const s of allSessions) {
    if (s.agent_id && !agentChannelMap.has(s.agent_id)) {
      agentChannelMap.set(s.agent_id, getChannelType(s.channel_id));
    }
  }

  const channelResponseMap = new Map<string, { totalMs: number; count: number }>();
  for (const row of analyticsRows) {
    const ct = agentChannelMap.get(row.agent_id) ?? "web";
    const cur = channelResponseMap.get(ct) ?? { totalMs: 0, count: 0 };
    channelResponseMap.set(ct, {
      totalMs: cur.totalMs + (row.total_ms ?? 0),
      count: cur.count + (row.total_count ?? 0),
    });
  }

  const byChannel = Array.from(byChannelMap.entries()).map(([ch, count]) => {
    const resp = channelResponseMap.get(ch);
    const avgResponseMs =
      resp && resp.count > 0 ? Math.round(resp.totalMs / resp.count) : null;
    return { channel: ch, count, avgResponseMs };
  });

  // volumeByHour — sessions created in last 24h grouped by hour
  const volumeRows = db
    .prepare(
      `SELECT strftime('%Y-%m-%dT%H:00:00Z', created_at) as hour, COUNT(*) as count
       FROM sessions
       WHERE created_at >= datetime('now', '-24 hours')
       GROUP BY hour
       ORDER BY hour ASC`
    )
    .all() as { hour: string; count: number }[];

  return c.json({
    totalActive: allSessions.length,
    byChannel,
    byStatus: byStatusMap,
    volumeByHour: volumeRows,
  });
});
