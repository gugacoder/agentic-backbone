import { Hono } from "hono";
import { db } from "../db/index.js";
import { getQuotas, getUsage } from "../quotas/quota-manager.js";

export const quotaRoutes = new Hono();

function hourlyWindow(): string {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  return now.toISOString().replace("T", " ").substring(0, 19);
}

function dailyWindow(): string {
  return new Date().toISOString().substring(0, 10);
}

// GET /agents/:agentId/quota
quotaRoutes.get("/agents/:agentId/quota", (c) => {
  const { agentId } = c.req.param();
  const config = getQuotas(agentId);

  const hourly = getUsage(agentId, "hourly", hourlyWindow());
  const daily = getUsage(agentId, "daily", dailyWindow());

  const hourlyPct =
    config.maxTokensPerHour !== undefined && config.maxTokensPerHour > 0
      ? Math.round((hourly.tokensUsed / config.maxTokensPerHour) * 1000) / 10
      : null;

  const dailyPct =
    config.maxHeartbeatsDay !== undefined && config.maxHeartbeatsDay > 0
      ? Math.round((daily.heartbeats / config.maxHeartbeatsDay) * 1000) / 10
      : null;

  // Determine status from agent_quotas DB (pause_on_exceed + usage)
  let status = "active";
  if (
    config.pauseOnExceed &&
    ((hourlyPct !== null && hourlyPct >= 100) ||
      (dailyPct !== null && dailyPct >= 100))
  ) {
    status = "paused_quota";
  }

  return c.json({
    agentId,
    config: {
      maxTokensPerHour: config.maxTokensPerHour ?? null,
      maxHeartbeatsDay: config.maxHeartbeatsDay ?? null,
      maxToolTimeoutMs: config.maxToolTimeoutMs ?? 30000,
      maxTokensPerRun: config.maxTokensPerRun ?? null,
      pauseOnExceed: config.pauseOnExceed ?? true,
    },
    usage: {
      hourly: {
        windowStart: hourly.windowStart,
        tokensUsed: hourly.tokensUsed,
        toolCalls: hourly.toolCalls,
        pctUsed: hourlyPct,
      },
      daily: {
        windowStart: daily.windowStart,
        heartbeats: daily.heartbeats,
        pctUsed: dailyPct,
      },
    },
    status,
  });
});

// PUT /agents/:agentId/quota
quotaRoutes.put("/agents/:agentId/quota", async (c) => {
  const { agentId } = c.req.param();
  const body = await c.req.json() as {
    maxTokensPerHour?: number | null;
    maxHeartbeatsDay?: number | null;
    maxToolTimeoutMs?: number | null;
    maxTokensPerRun?: number | null;
    pauseOnExceed?: boolean;
  };

  db.prepare(`
    INSERT INTO agent_quotas (agent_id, max_tokens_per_hour, max_heartbeats_day, max_tool_timeout_ms, max_tokens_per_run, pause_on_exceed, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(agent_id) DO UPDATE SET
      max_tokens_per_hour = excluded.max_tokens_per_hour,
      max_heartbeats_day  = excluded.max_heartbeats_day,
      max_tool_timeout_ms = excluded.max_tool_timeout_ms,
      max_tokens_per_run  = excluded.max_tokens_per_run,
      pause_on_exceed     = excluded.pause_on_exceed,
      updated_at          = datetime('now')
  `).run(
    agentId,
    body.maxTokensPerHour ?? null,
    body.maxHeartbeatsDay ?? null,
    body.maxToolTimeoutMs ?? 30000,
    body.maxTokensPerRun ?? null,
    body.pauseOnExceed !== false ? 1 : 0,
  );

  const config = getQuotas(agentId);
  return c.json({ ok: true, config });
});

// DELETE /agents/:agentId/quota
quotaRoutes.delete("/agents/:agentId/quota", (c) => {
  const { agentId } = c.req.param();
  db.prepare("DELETE FROM agent_quotas WHERE agent_id = ?").run(agentId);
  return c.json({ ok: true });
});

// POST /agents/:agentId/quota/reset
quotaRoutes.post("/agents/:agentId/quota/reset", (c) => {
  const { agentId } = c.req.param();
  const hw = hourlyWindow();
  const dw = dailyWindow();

  db.prepare(
    "DELETE FROM agent_quota_usage WHERE agent_id = ? AND ((window_type = 'hourly' AND window_start = ?) OR (window_type = 'daily' AND window_start = ?))"
  ).run(agentId, hw, dw);

  return c.json({ ok: true, resetWindows: { hourly: hw, daily: dw } });
});
