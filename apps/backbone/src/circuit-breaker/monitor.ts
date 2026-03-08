import type { CircuitBreakerConfig } from "./schemas.js";

interface Outcome {
  success: boolean;
  ts: number;
}

interface AgentMonitor {
  consecutiveFails: number;
  outcomes: Outcome[]; // rolling window for error rate
  hourWindowStart: number;
  actionsThisHour: number;
  dayWindowStart: number;
  actionsToday: number;
}

const monitors = new Map<string, AgentMonitor>();

function getMonitor(agentId: string): AgentMonitor {
  let m = monitors.get(agentId);
  if (!m) {
    const now = Date.now();
    m = {
      consecutiveFails: 0,
      outcomes: [],
      hourWindowStart: now,
      actionsThisHour: 0,
      dayWindowStart: now,
      actionsToday: 0,
    };
    monitors.set(agentId, m);
  }
  return m;
}

/** Resets window counters if the window has rolled over. */
function refreshWindows(m: AgentMonitor): void {
  const now = Date.now();
  if (now - m.hourWindowStart >= 60 * 60 * 1000) {
    m.hourWindowStart = now;
    m.actionsThisHour = 0;
  }
  if (now - m.dayWindowStart >= 24 * 60 * 60 * 1000) {
    m.dayWindowStart = now;
    m.actionsToday = 0;
  }
}

/** Prunes error-rate outcomes outside the configured window. */
function pruneOutcomes(m: AgentMonitor, windowMin: number): void {
  const cutoff = Date.now() - windowMin * 60 * 1000;
  m.outcomes = m.outcomes.filter((o) => o.ts >= cutoff);
}

export interface TripCheck {
  tripped: boolean;
  reason?: string;
}

/**
 * Record an execution outcome. Returns TripCheck indicating whether
 * the circuit should trip after this outcome.
 */
export function recordOutcome(
  agentId: string,
  success: boolean,
  config: CircuitBreakerConfig
): TripCheck {
  const m = getMonitor(agentId);
  refreshWindows(m);

  // Track action counts
  m.actionsThisHour++;
  m.actionsToday++;

  // Track consecutive fails
  if (success) {
    m.consecutiveFails = 0;
  } else {
    m.consecutiveFails++;
  }

  // Track outcomes for error rate
  m.outcomes.push({ success, ts: Date.now() });
  pruneOutcomes(m, config.errorRateWindowMin);

  // Check consecutive fails threshold
  if (m.consecutiveFails >= config.maxConsecutiveFails) {
    return { tripped: true, reason: `consecutive_fails:${m.consecutiveFails}` };
  }

  // Check error rate in window
  if (m.outcomes.length >= 3) {
    const errors = m.outcomes.filter((o) => !o.success).length;
    const rate = errors / m.outcomes.length;
    if (rate > config.errorRateThreshold) {
      return {
        tripped: true,
        reason: `error_rate:${rate.toFixed(2)}`,
      };
    }
  }

  // Check action limits (post-increment — trips on reaching the limit)
  if (m.actionsThisHour >= config.maxActionsPerHour) {
    return { tripped: true, reason: `action_limit:hour` };
  }
  if (m.actionsToday >= config.maxActionsPerDay) {
    return { tripped: true, reason: `action_limit:day` };
  }

  return { tripped: false };
}

/**
 * Check action limits before execution (pre-execution check).
 * Returns true if the agent has exceeded its action limits.
 */
export function isActionLimitExceeded(
  agentId: string,
  config: CircuitBreakerConfig
): { exceeded: boolean; reason?: string } {
  const m = getMonitor(agentId);
  refreshWindows(m);

  if (m.actionsThisHour >= config.maxActionsPerHour) {
    return { exceeded: true, reason: `action_limit:hour (${m.actionsThisHour}/${config.maxActionsPerHour})` };
  }
  if (m.actionsToday >= config.maxActionsPerDay) {
    return { exceeded: true, reason: `action_limit:day (${m.actionsToday}/${config.maxActionsPerDay})` };
  }
  return { exceeded: false };
}

export function getCounters(agentId: string): {
  consecutiveFails: number;
  actionsThisHour: number;
  actionsToday: number;
} {
  const m = getMonitor(agentId);
  refreshWindows(m);
  return {
    consecutiveFails: m.consecutiveFails,
    actionsThisHour: m.actionsThisHour,
    actionsToday: m.actionsToday,
  };
}

export function resetCounters(agentId: string): void {
  monitors.delete(agentId);
}
