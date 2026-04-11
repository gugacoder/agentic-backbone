import { Hono } from "hono";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { listAgents } from "../agents/registry.js";
import { listChannels } from "../channels/registry.js";
import { getHeartbeatStatus } from "../heartbeat/index.js";
import { getGlobalHeartbeatStats } from "../heartbeat/log.js";
import { createSSEHandler } from "../events/sse.js";
import { assemblePrompt } from "../context/index.js";
import { runAgent } from "../agent/index.js";
import { deliverToSystemChannel } from "../channels/system-channel.js";
import { CONTEXT_DIR, agentDir } from "../context/paths.js";
import { db } from "../db/index.js";
import { requireSysuser } from "./auth-helpers.js";
import { getHookSnapshot } from "../hooks/index.js";
import { collectAgentResult } from "../utils/agent-stream.js";
import { listCronJobs } from "../cron/index.js";
import { listJobs } from "../jobs/engine.js";

export const systemRoutes = new Hono();

// --- System SSE (accessible to all) ---

systemRoutes.get("/system/events", createSSEHandler("system"));

// --- System Messages (sysuser only) ---

systemRoutes.post("/system/messages", async (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const { message } = await c.req.json<{ message: string }>();
  if (!message) return c.json({ error: "message is required" }, 400);

  (async () => {
    try {
      const assembled = await assemblePrompt("system.main", "conversation", { userMessage: message });
      if (!assembled) return;
      const { fullText } = await collectAgentResult(runAgent(assembled.userMessage, { role: "conversation", system: assembled.system, cwd: agentDir("system.main") }));
      if (fullText) {
        deliverToSystemChannel("system.main", fullText);
      }
    } catch (err) {
      console.error("[system/messages] failed:", err);
    }
  })();

  return c.json({ status: "accepted" }, 202);
});

// --- Dashboard Aggregate (accessible to all) ---

systemRoutes.get("/system/dashboard", (c) => {
  const agents = listAgents();
  const agentTotal = agents.length;
  const agentEnabled = agents.filter((a) => a.enabled).length;
  const agentHeartbeatEnabled = agents.filter((a) => a.heartbeat.enabled).length;

  // Heartbeat stats for today
  const hbToday = db
    .prepare(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END) as ok,
         SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error,
         SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped,
         COALESCE(SUM(cost_usd), 0) as costToday
       FROM heartbeat_log
       WHERE date(ts) = date('now')`
    )
    .get() as { total: number; ok: number; error: number; skipped: number; costToday: number };

  // Conversations
  const convStats = db
    .prepare(
      `SELECT
         COUNT(*) as totalSessions,
         SUM(CASE WHEN date(created_at) = date('now') THEN 1 ELSE 0 END) as today
       FROM sessions`
    )
    .get() as { totalSessions: number; today: number };

  // Cron jobs
  const cronJobs = listCronJobs({ includeDisabled: true });
  const cronEnabled = cronJobs.filter((j) => j.def.enabled).length;
  const nextRuns = cronJobs
    .filter((j) => j.def.enabled && j.state.nextRunAtMs != null)
    .sort((a, b) => (a.state.nextRunAtMs ?? 0) - (b.state.nextRunAtMs ?? 0))
    .slice(0, 5)
    .map((j) => ({
      agentId: j.agentId,
      slug: j.slug,
      schedule: j.def.schedule.kind === "cron" ? j.def.schedule.expr : j.def.schedule.kind,
      nextRun: new Date(j.state.nextRunAtMs!).toISOString(),
    }));

  // Jobs
  const allJobs = listJobs();
  const jobsRunning = allJobs.filter((j) => j.status === "running").length;
  const jobsCompleted = allJobs.filter((j) => j.status === "completed").length;
  const jobsFailed = allJobs.filter((j) => j.status === "failed").length;

  // Recent activity (UNION of heartbeat_log, cron_run_log, sessions)
  const recentActivity = db
    .prepare(
      `SELECT * FROM (
         SELECT
           'heartbeat' as type,
           agent_id as agentId,
           status,
           ts,
           preview,
           NULL as slug,
           NULL as sessionId
         FROM heartbeat_log
         UNION ALL
         SELECT
           'cron' as type,
           agent_id as agentId,
           status,
           ts,
           summary as preview,
           job_slug as slug,
           NULL as sessionId
         FROM cron_run_log
         UNION ALL
         SELECT
           'conversation' as type,
           agent_id as agentId,
           'ok' as status,
           created_at as ts,
           title as preview,
           NULL as slug,
           session_id as sessionId
         FROM sessions
       ) ORDER BY ts DESC LIMIT 20`
    )
    .all();

  return c.json({
    agents: {
      total: agentTotal,
      enabled: agentEnabled,
      heartbeatEnabled: agentHeartbeatEnabled,
    },
    heartbeats: {
      today: {
        total: hbToday.total,
        ok: hbToday.ok,
        error: hbToday.error,
        skipped: hbToday.skipped,
      },
      costToday: hbToday.costToday,
    },
    conversations: {
      totalSessions: convStats.totalSessions,
      today: convStats.today,
    },
    cronJobs: {
      total: cronJobs.length,
      enabled: cronEnabled,
      nextRuns,
    },
    jobs: {
      running: jobsRunning,
      completed: jobsCompleted,
      failed: jobsFailed,
    },
    recentActivity,
    system: {
      uptime: process.uptime(),
      version: "0.0.1",
    },
  });
});

// --- System Stats (accessible to all) ---

systemRoutes.get("/system/stats", (c) => {
  const sessions = (
    db.prepare("SELECT COUNT(*) as c FROM sessions").get() as { c: number }
  ).c;

  return c.json({
    uptime: process.uptime(),
    agents: listAgents().length,
    channels: listChannels().length,
    sessions,
    memoryUsage: process.memoryUsage(),
  });
});

// --- Global Heartbeat Stats (accessible to all) ---

systemRoutes.get("/system/heartbeat/stats", (c) => {
  return c.json(getGlobalHeartbeatStats());
});

// --- Hooks Status (accessible to all) ---

systemRoutes.get("/system/hooks", (c) => {
  return c.json(getHookSnapshot());
});

// --- System Info (accessible to all) ---

systemRoutes.get("/system/info", (c) =>
  c.json({
    version: "0.0.1",
    nodeVersion: process.version,
    platform: process.platform,
    contextDir: CONTEXT_DIR,
  })
);

// --- Environment Status (sysuser only) ---

systemRoutes.get("/system/env", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;
  return c.json({
    OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    BACKBONE_PORT: process.env.BACKBONE_PORT,
    NODE_ENV: process.env.NODE_ENV,
  });
});

// --- Context Tree (sysuser only) ---

systemRoutes.get("/system/context-tree", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  function buildTree(dir: string, depth = 0): unknown[] {
    if (!existsSync(dir) || depth > 4) return [];
    const items: unknown[] = [];
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith(".")) continue;
        if (entry.isDirectory()) {
          items.push({
            name: entry.name,
            type: "directory",
            children: buildTree(join(dir, entry.name), depth + 1),
          });
        } else {
          items.push({ name: entry.name, type: "file" });
        }
      }
    } catch {
      // permission errors
    }
    return items;
  }

  return c.json({ root: CONTEXT_DIR, tree: buildTree(CONTEXT_DIR) });
});

// --- Active Processes (sysuser only) ---

systemRoutes.get("/system/processes", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const agents = listAgents();
  const heartbeat = getHeartbeatStatus();
  const processes: unknown[] = [];

  for (const agent of agents) {
    const hb = heartbeat[agent.id];
    if (hb?.running) {
      processes.push({
        type: "heartbeat",
        agentId: agent.id,
        status: "running",
      });
    }
  }

  return c.json(processes);
});

// --- Refresh Registries (sysuser only) ---

systemRoutes.post("/system/refresh", async (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const { refreshAgentRegistry } = await import("../agents/registry.js");
  const { refreshChannelRegistry } = await import("../channels/registry.js");

  refreshAgentRegistry();
  refreshChannelRegistry();

  return c.json({
    status: "refreshed",
    agents: listAgents().length,
    channels: listChannels().length,
  });
});

// --- Context File Operations (sysuser only) ---

systemRoutes.get("/system/context/*", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const filePath = c.req.path.replace(/^\/system\/context\//, "");
  const fullPath = join(CONTEXT_DIR, filePath);

  if (!existsSync(fullPath)) {
    return c.json({ error: "not found" }, 404);
  }

  try {
    const content = readFileSync(fullPath, "utf-8");
    return c.json({ path: filePath, content });
  } catch {
    return c.json({ error: "read error" }, 500);
  }
});
