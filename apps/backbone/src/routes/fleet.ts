import { Hono } from "hono";
import { z } from "zod";
import { listAgents, getAgent } from "../agents/registry.js";
import { updateAgent } from "../agents/manager.js";
import { circuitBreaker } from "../circuit-breaker/index.js";
import { triggerManualHeartbeat, updateHeartbeatAgent } from "../heartbeat/index.js";
import { db } from "../db/index.js";
import { getAuthUser, filterByOwner, assertOwnership } from "./auth-helpers.js";
import { formatError } from "../utils/errors.js";

export const fleetRoutes = new Hono();

// ── Helpers ────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function since24hStr(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

interface HeartbeatHealth {
  heartbeatSuccessRate24h: number;
  lastHeartbeat: string | null;
  lastHeartbeatResult: string | null;
  consecutiveFails: number;
}

interface AgentConsumption {
  tokensToday: number;
  costToday: number;
}

interface AgentActivity {
  conversationsToday: number;
  cronRunsToday: number;
  lastActivity: string | null;
}

type FleetStatus = "active" | "paused" | "alert" | "killed" | "error";

function computeStatus(
  agent: { enabled: boolean },
  cbState: { killSwitch: boolean; tripped: boolean },
  health: HeartbeatHealth
): FleetStatus {
  if (cbState.killSwitch) return "killed";
  if (!agent.enabled) return "paused";
  if (cbState.tripped) return "alert";
  if (health.consecutiveFails >= 3) return "error";
  return "active";
}

function getHeartbeatHealth(agentId: string, since24h: string): HeartbeatHealth {
  const rows = db
    .prepare(
      `SELECT status FROM heartbeat_log WHERE agent_id = ? AND ts >= ? ORDER BY ts DESC`
    )
    .all(agentId, since24h) as Array<{ status: string }>;

  const total = rows.length;
  const successes = rows.filter((r) => r.status === "ok" || r.status === "sent").length;
  const rate = total > 0 ? successes / total : 1;

  const last = db
    .prepare(
      `SELECT ts, status FROM heartbeat_log WHERE agent_id = ? ORDER BY ts DESC LIMIT 1`
    )
    .get(agentId) as { ts: string; status: string } | undefined;

  // Count consecutive fails from most recent
  let consecutiveFails = 0;
  for (const r of rows) {
    if (r.status === "failed") consecutiveFails++;
    else break;
  }

  return {
    heartbeatSuccessRate24h: Math.round(rate * 100) / 100,
    lastHeartbeat: last?.ts ?? null,
    lastHeartbeatResult: last?.status ?? null,
    consecutiveFails,
  };
}

function getConsumption(agentId: string, today: string): AgentConsumption {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(tokens_in + tokens_out), 0) AS tokensToday,
              COALESCE(SUM(cost_usd), 0) AS costToday
       FROM cost_daily WHERE agent_id = ? AND date = ?`
    )
    .get(agentId, today) as { tokensToday: number; costToday: number } | undefined;

  return {
    tokensToday: row?.tokensToday ?? 0,
    costToday: row?.costToday ?? 0,
  };
}

function getActivity(agentId: string, today: string): AgentActivity {
  const convRow = db
    .prepare(
      `SELECT COUNT(*) AS count FROM sessions
       WHERE agent_id = ? AND date(created_at) = ?`
    )
    .get(agentId, today) as { count: number } | undefined;

  const cronRow = db
    .prepare(
      `SELECT COUNT(*) AS count FROM cron_run_log
       WHERE agent_id = ? AND date(ts) = ?`
    )
    .get(agentId, today) as { count: number } | undefined;

  // Last activity: max of last heartbeat and last session
  const lastHb = db
    .prepare(
      `SELECT ts FROM heartbeat_log WHERE agent_id = ? ORDER BY ts DESC LIMIT 1`
    )
    .get(agentId) as { ts: string } | undefined;

  const lastSession = db
    .prepare(
      `SELECT updated_at FROM sessions WHERE agent_id = ? ORDER BY updated_at DESC LIMIT 1`
    )
    .get(agentId) as { updated_at: string } | undefined;

  const times = [lastHb?.ts, lastSession?.updated_at].filter(Boolean) as string[];
  const lastActivity = times.length > 0 ? times.sort().at(-1)! : null;

  return {
    conversationsToday: convRow?.count ?? 0,
    cronRunsToday: cronRow?.count ?? 0,
    lastActivity,
  };
}

function buildFleetAgent(
  agentId: string,
  agent: { enabled: boolean; owner: string; metadata: Record<string, unknown> },
  today: string,
  since24h: string
) {
  const cbState = circuitBreaker.getState(agentId);
  const health = getHeartbeatHealth(agentId, since24h);
  const consumption = getConsumption(agentId, today);
  const activity = getActivity(agentId, today);
  const status = computeStatus(agent, cbState, health);

  // Extract channel slugs from metadata
  const channels: string[] = [];
  const delivery = agent.metadata["delivery"] as string | undefined;
  if (delivery) channels.push(delivery);

  const alerts: string[] = [];
  if (cbState.killSwitch) alerts.push("kill_switch_active");
  if (cbState.tripped) alerts.push("circuit_breaker_tripped");
  if (health.consecutiveFails >= 3) alerts.push(`${health.consecutiveFails}_consecutive_fails`);

  const label =
    (agent.metadata["label"] as string | undefined) ??
    (agent.metadata["name"] as string | undefined) ??
    agentId;

  return {
    id: agentId,
    label,
    owner: agent.owner,
    enabled: agent.enabled,
    status,
    circuitBreaker: {
      killSwitch: cbState.killSwitch,
      tripped: cbState.tripped,
    },
    health,
    consumption,
    activity,
    alerts,
    channels,
  };
}

// ── GET /fleet ─────────────────────────────────────────────

fleetRoutes.get("/fleet", (c) => {
  const auth = getAuthUser(c);
  const today = todayStr();
  const since24h = since24hStr();

  const ownerFilter = c.req.query("owner");
  const statusFilter = c.req.query("status") as FleetStatus | undefined;
  const sortBy = c.req.query("sortBy") ?? "name";
  const sortDir = c.req.query("sortDir") === "desc" ? "desc" : "asc";

  let agents = listAgents();

  // Role-based filter
  if (auth.role !== "sysuser") {
    agents = agents.filter((a) => a.owner === auth.user);
  }

  // Owner filter (combinable with role filter)
  if (ownerFilter) {
    agents = agents.filter((a) => a.owner === ownerFilter);
  }

  const total = agents.length;

  // Build fleet entries
  let fleet = agents.map((a) => buildFleetAgent(a.id, a, today, since24h));

  // Status filter
  if (statusFilter) {
    // "error" matches both "error" and "alert" states
    if (statusFilter === "error") {
      fleet = fleet.filter((f) => f.status === "error" || f.status === "alert");
    } else {
      fleet = fleet.filter((f) => f.status === statusFilter);
    }
  }

  const filtered = fleet.length;

  // Sort
  fleet.sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case "tokens":
        cmp = a.consumption.tokensToday - b.consumption.tokensToday;
        break;
      case "errors":
        cmp = a.health.consecutiveFails - b.health.consecutiveFails;
        break;
      case "lastActivity":
        cmp = (a.activity.lastActivity ?? "").localeCompare(
          b.activity.lastActivity ?? ""
        );
        break;
      case "name":
      default:
        cmp = a.label.localeCompare(b.label);
        break;
    }
    return sortDir === "desc" ? -cmp : cmp;
  });

  return c.json({ agents: fleet, total, filtered });
});

// ── POST /fleet/batch ──────────────────────────────────────

const BatchActionSchema = z.object({
  agentIds: z.array(z.string()).min(1),
  action: z.enum([
    "enable",
    "disable",
    "trigger_heartbeat",
    "activate_kill_switch",
    "deactivate_kill_switch",
  ]),
});

fleetRoutes.post("/fleet/batch", async (c) => {
  const auth = getAuthUser(c);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }

  const parsed = BatchActionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation error", issues: parsed.error.issues }, 422);
  }

  const { agentIds, action } = parsed.data;
  const results: Array<{
    agentId: string;
    ok: boolean;
    error?: string;
  }> = [];

  for (const agentId of agentIds) {
    const agent = getAgent(agentId);
    if (!agent) {
      results.push({ agentId, ok: false, error: "not found" });
      continue;
    }

    // Ownership check for non-sysuser
    if (auth.role !== "sysuser" && agent.owner !== auth.user) {
      results.push({ agentId, ok: false, error: "forbidden" });
      continue;
    }

    try {
      switch (action) {
        case "enable": {
          const updated = updateAgent(agentId, { enabled: true });
          updateHeartbeatAgent(agentId, updated.heartbeat);
          break;
        }
        case "disable": {
          const updated = updateAgent(agentId, { enabled: false });
          updateHeartbeatAgent(agentId, updated.heartbeat);
          break;
        }
        case "trigger_heartbeat":
          triggerManualHeartbeat(agentId).catch(() => {
            /* best-effort */
          });
          break;
        case "activate_kill_switch":
          circuitBreaker.activateKillSwitch(agentId, auth.user);
          break;
        case "deactivate_kill_switch":
          circuitBreaker.deactivateKillSwitch(agentId, auth.user);
          circuitBreaker.resume(agentId, auth.user);
          break;
      }
      results.push({ agentId, ok: true });
    } catch (err) {
      results.push({ agentId, ok: false, error: formatError(err) });
    }
  }

  return c.json({ results });
});

// ── GET /fleet/summary ─────────────────────────────────────

fleetRoutes.get("/fleet/summary", (c) => {
  const auth = getAuthUser(c);
  const today = todayStr();
  const since24h = since24hStr();

  let agents = listAgents();
  if (auth.role !== "sysuser") {
    agents = agents.filter((a) => a.owner === auth.user);
  }

  let totalAgents = 0;
  let activeAgents = 0;
  let pausedAgents = 0;
  let errorAgents = 0;
  let killedAgents = 0;
  let totalTokensToday = 0;
  let totalCostToday = 0;
  let healthRateSum = 0;
  let activeAlerts = 0;

  for (const agent of agents) {
    totalAgents++;
    const cbState = circuitBreaker.getState(agent.id);
    const health = getHeartbeatHealth(agent.id, since24h);
    const status = computeStatus(agent, cbState, health);

    switch (status) {
      case "active":
        activeAgents++;
        break;
      case "paused":
        pausedAgents++;
        break;
      case "error":
      case "alert":
        errorAgents++;
        activeAlerts++;
        break;
      case "killed":
        killedAgents++;
        activeAlerts++;
        break;
    }

    healthRateSum += health.heartbeatSuccessRate24h;

    const costRow = db
      .prepare(
        `SELECT COALESCE(SUM(tokens_in + tokens_out), 0) AS tokens,
                COALESCE(SUM(cost_usd), 0) AS cost
         FROM cost_daily WHERE agent_id = ? AND date = ?`
      )
      .get(agent.id, today) as { tokens: number; cost: number } | undefined;

    totalTokensToday += costRow?.tokens ?? 0;
    totalCostToday += costRow?.cost ?? 0;
  }

  const avgHealthRate =
    totalAgents > 0
      ? Math.round((healthRateSum / totalAgents) * 100) / 100
      : 1;

  return c.json({
    totalAgents,
    activeAgents,
    pausedAgents,
    errorAgents,
    killedAgents,
    totalTokensToday,
    totalCostToday: Math.round(totalCostToday * 10000) / 10000,
    avgHealthRate,
    activeAlerts,
  });
});
