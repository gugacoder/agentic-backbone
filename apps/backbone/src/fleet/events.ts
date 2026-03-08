import { db } from "../db/index.js";
import { eventBus } from "../events/index.js";
import { circuitBreaker } from "../circuit-breaker/index.js";
import { getAgent } from "../agents/registry.js";

// ---------- helpers (inline to avoid circular deps with routes/fleet.ts) ----------

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function since24hStr(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

type FleetStatus = "active" | "paused" | "alert" | "killed" | "error";

function computeStatus(
  enabled: boolean,
  killSwitch: boolean,
  tripped: boolean,
  consecutiveFails: number
): FleetStatus {
  if (killSwitch) return "killed";
  if (!enabled) return "paused";
  if (tripped) return "alert";
  if (consecutiveFails >= 3) return "error";
  return "active";
}

function getHeartbeatHealth(agentId: string) {
  const since24h = since24hStr();
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

function getConsumption(agentId: string) {
  const today = todayStr();
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

// ---------- public emit helper ----------

export function emitFleetAgentStatus(agentId: string): void {
  const agent = getAgent(agentId);
  const enabled = agent?.enabled ?? false;

  const cbState = circuitBreaker.getState(agentId);
  const health = getHeartbeatHealth(agentId);
  const consumption = getConsumption(agentId);
  const status = computeStatus(enabled, cbState.killSwitch, cbState.tripped, health.consecutiveFails);

  eventBus.emit("fleet:agent_status", {
    ts: Date.now(),
    agentId,
    status,
    health,
    consumption,
  });
}

// ---------- consecutive-fail tracker (in-memory, emit alert on 3rd) ----------

const consecutiveFailCounts = new Map<string, number>();

function handleHeartbeatFail(agentId: string): void {
  const prev = consecutiveFailCounts.get(agentId) ?? 0;
  const next = prev + 1;
  consecutiveFailCounts.set(agentId, next);

  // Emit alert exactly when reaching 3 (state change: 2 → 3)
  if (next === 3) {
    eventBus.emit("fleet:alert", {
      ts: Date.now(),
      agentId,
      alertType: "consecutive_fails",
      message: `Agente ${agentId} falhou em 3 heartbeats consecutivos`,
    });
  }
}

function resetFailCount(agentId: string): void {
  consecutiveFailCounts.delete(agentId);
}

// ---------- init ----------

export function initFleetEvents(): void {
  // heartbeat:status → emit fleet:agent_status + track consecutive fails
  eventBus.on("heartbeat:status", (evt) => {
    if (evt.status === "failed") {
      handleHeartbeatFail(evt.agentId);
    } else if (evt.status === "ok-token" || evt.status === "sent") {
      resetFailCount(evt.agentId);
    }
    // Always emit updated status after any heartbeat result
    emitFleetAgentStatus(evt.agentId);
  });

  // circuit_breaker:tripped → fleet:alert + fleet:agent_status
  eventBus.on("circuit_breaker:tripped", (evt) => {
    eventBus.emit("fleet:alert", {
      ts: Date.now(),
      agentId: evt.agentId,
      alertType: "circuit_breaker_trip",
      message: `Circuit-breaker ativado para ${evt.agentId}: ${evt.reason}`,
    });
    emitFleetAgentStatus(evt.agentId);
  });

  // circuit_breaker:resumed → fleet:agent_status
  eventBus.on("circuit_breaker:resumed", (evt) => {
    resetFailCount(evt.agentId);
    emitFleetAgentStatus(evt.agentId);
  });

  // circuit_breaker:kill_switch → fleet:agent_status (+ alert when activated)
  eventBus.on("circuit_breaker:kill_switch", (evt) => {
    if (evt.active) {
      eventBus.emit("fleet:alert", {
        ts: Date.now(),
        agentId: evt.agentId,
        alertType: "kill_switch",
        message: `Kill-switch ativado para ${evt.agentId} por ${evt.actor}`,
      });
    }
    emitFleetAgentStatus(evt.agentId);
  });

  console.log("[fleet:events] initialized");
}
