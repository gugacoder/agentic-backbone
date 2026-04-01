import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { eventBus } from "../events/index.js";
import { sendPushToAll } from "../notifications/push.js";
import { getConfig, saveConfig } from "./config.js";
import {
  recordOutcome as monitorRecordOutcome,
  isActionLimitExceeded,
  getCounters,
  resetCounters,
} from "./monitor.js";
import type {
  CircuitBreakerState,
  CircuitBreakerConfig,
  CircuitBreakerConfigUpdate,
  CircuitBreakerEvent,
} from "./schemas.js";

export type { CircuitBreakerState, CircuitBreakerConfig, CircuitBreakerConfigUpdate, CircuitBreakerEvent };

// ---------- in-memory state ---------------------------------------------------

/** kill-switch state: agentId → active */
const killSwitches = new Map<string, boolean>();

/** tripped state: agentId → { trippedAt, resumeAt } */
interface TripState {
  trippedAt: string;
  resumeAt: string | null;
}
const tripped = new Map<string, TripState>();

/** auto-resume timers: agentId → timer */
const resumeTimers = new Map<string, ReturnType<typeof setTimeout>>();

// ---------- DB helpers --------------------------------------------------------

function insertEvent(
  agentId: string,
  eventType: string,
  triggerReason: string | null,
  context: string | null,
  actor: string | null
): void {
  db.prepare(`
    INSERT INTO circuit_breaker_events (id, agent_id, event_type, trigger_reason, context, actor, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(randomUUID(), agentId, eventType, triggerReason, context, actor);
}

function getEvents(agentId: string, limit = 50): CircuitBreakerEvent[] {
  const rows = db.prepare(`
    SELECT id, agent_id, event_type, trigger_reason, context, actor, created_at
    FROM circuit_breaker_events
    WHERE agent_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(agentId, limit) as Array<{
    id: string;
    agent_id: string;
    event_type: string;
    trigger_reason: string | null;
    context: string | null;
    actor: string | null;
    created_at: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    agentId: r.agent_id,
    eventType: r.event_type as CircuitBreakerEvent["eventType"],
    triggerReason: r.trigger_reason,
    context: r.context,
    actor: r.actor,
    createdAt: r.created_at,
  }));
}

// ---------- internal trip/resume logic ----------------------------------------

function trip(agentId: string, reason: string, config: CircuitBreakerConfig): void {
  if (tripped.has(agentId)) return; // already tripped

  const now = new Date().toISOString();
  const resumeAt = config.autoResume
    ? new Date(Date.now() + config.cooldownMin * 60 * 1000).toISOString()
    : null;

  tripped.set(agentId, { trippedAt: now, resumeAt });

  insertEvent(agentId, "tripped", reason, null, null);

  eventBus.emit("circuit_breaker:tripped", {
    ts: Date.now(),
    agentId,
    reason,
    trippedAt: now,
  });

  sendPushToAll({
    title: `⚠ Agente ${agentId} pausado automaticamente`,
    body: reason,
  }).catch(() => { /* best-effort */ });

  if (config.autoResume) {
    const timer = setTimeout(() => {
      resumeAgent(agentId, null);
    }, config.cooldownMin * 60 * 1000);
    resumeTimers.set(agentId, timer);
  }
}

function resumeAgent(agentId: string, actor: string | null): void {
  tripped.delete(agentId);
  resetCounters(agentId);

  const timer = resumeTimers.get(agentId);
  if (timer) {
    clearTimeout(timer);
    resumeTimers.delete(agentId);
  }

  const now = new Date().toISOString();
  insertEvent(agentId, "resumed", null, null, actor);

  eventBus.emit("circuit_breaker:resumed", {
    ts: Date.now(),
    agentId,
    actor,
    resumedAt: now,
  });
}

// ---------- initialization ---------------------------------------------------

/**
 * Restore kill-switch state from circuit_breaker_events on startup.
 * For each agent, find the latest kill_switch_on/kill_switch_off event.
 */
export function initCircuitBreaker(): void {
  const rows = db.prepare(`
    SELECT agent_id, event_type, created_at
    FROM circuit_breaker_events
    WHERE event_type IN ('kill_switch_on', 'kill_switch_off')
    ORDER BY created_at ASC
  `).all() as Array<{ agent_id: string; event_type: string; created_at: string }>;

  for (const row of rows) {
    killSwitches.set(row.agent_id, row.event_type === "kill_switch_on");
  }

  console.log(`[circuit-breaker] initialized — ${killSwitches.size} agents with kill-switch state`);
}

// ---------- public API -------------------------------------------------------

export const circuitBreaker = {
  /**
   * Check if an agent is allowed to execute.
   * Called before every autonomous execution (heartbeat, cron, webhook).
   */
  canExecute(agentId: string): { allowed: boolean; reason?: string } {
    // 1. Kill-switch check
    if (killSwitches.get(agentId) === true) {
      return { allowed: false, reason: "kill_switch_active" };
    }

    // 2. Tripped check
    const tripState = tripped.get(agentId);
    if (tripState) {
      return {
        allowed: false,
        reason: `circuit_tripped (since ${tripState.trippedAt})`,
      };
    }

    // 3. Action limit pre-check
    const config = getConfig(agentId);
    if (config.enabled) {
      const limitCheck = isActionLimitExceeded(agentId, config);
      if (limitCheck.exceeded) {
        return { allowed: false, reason: limitCheck.reason };
      }
    }

    return { allowed: true };
  },

  /**
   * Record an execution outcome. Evaluates trip conditions.
   */
  recordOutcome(agentId: string, success: boolean): void {
    const config = getConfig(agentId);
    if (!config.enabled) return;

    const tripCheck = monitorRecordOutcome(agentId, success, config);
    if (tripCheck.tripped && !tripped.has(agentId)) {
      trip(agentId, tripCheck.reason ?? "threshold_exceeded", config);
    }
  },

  /**
   * Activate kill-switch for an agent (manual emergency stop).
   */
  activateKillSwitch(agentId: string, actorId: string): void {
    killSwitches.set(agentId, true);
    insertEvent(agentId, "kill_switch_on", "manual", null, actorId);

    eventBus.emit("circuit_breaker:kill_switch", {
      ts: Date.now(),
      agentId,
      active: true,
      actor: actorId,
    });

    sendPushToAll({
      title: `🛑 Agente ${agentId} parado manualmente`,
      body: `Por: ${actorId}`,
    }).catch(() => { /* best-effort */ });
  },

  /**
   * Deactivate kill-switch and resume normal operation.
   */
  deactivateKillSwitch(agentId: string, actorId: string): void {
    killSwitches.set(agentId, false);
    insertEvent(agentId, "kill_switch_off", "manual", null, actorId);

    eventBus.emit("circuit_breaker:kill_switch", {
      ts: Date.now(),
      agentId,
      active: false,
      actor: actorId,
    });
  },

  /**
   * Resume a tripped circuit-breaker (clears trip state and resets counters).
   */
  resume(agentId: string, actorId: string): void {
    resumeAgent(agentId, actorId);
  },

  /** Get state for a single agent. */
  getState(agentId: string): CircuitBreakerState {
    const counters = getCounters(agentId);
    const tripState = tripped.get(agentId);
    return {
      agentId,
      killSwitch: killSwitches.get(agentId) === true,
      tripped: !!tripState,
      trippedAt: tripState?.trippedAt ?? null,
      resumeAt: tripState?.resumeAt ?? null,
      consecutiveFails: counters.consecutiveFails,
      actionsThisHour: counters.actionsThisHour,
      actionsToday: counters.actionsToday,
    };
  },

  /** Get state for all agents that have non-default state. */
  getAllStates(): CircuitBreakerState[] {
    const agentIds = new Set<string>([
      ...killSwitches.keys(),
      ...tripped.keys(),
    ]);

    // Include agents with kill-switch off (explicitly set)
    return Array.from(agentIds).map((id) => circuitBreaker.getState(id));
  },

  /** Get circuit-breaker config for an agent. */
  getConfig,

  /** Update circuit-breaker config for an agent. */
  saveConfig,

  /** Get event history for an agent. */
  getEvents,

  /** Record a blocked action event in DB (for audit trail). */
  recordBlocked(
    agentId: string,
    reason: string,
    context: Record<string, unknown>
  ): void {
    insertEvent(
      agentId,
      "action_blocked",
      reason,
      JSON.stringify(context),
      null
    );
  },
};
