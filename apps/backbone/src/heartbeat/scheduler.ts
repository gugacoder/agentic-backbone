import type { HeartbeatConfig } from "../agents/types.js";

export interface HeartbeatAgentState {
  agentId: string;
  config: HeartbeatConfig;
  nextDueMs: number;
  lastRunMs: number;
}

export interface HeartbeatScheduler {
  addAgent(agentId: string, config: HeartbeatConfig): void;
  removeAgent(agentId: string): void;
  updateAgent(agentId: string, config: HeartbeatConfig): void;
  getStates(): Map<string, HeartbeatAgentState>;
  start(): void;
  stop(): void;
}

export function createHeartbeatScheduler(
  onTick: (agentId: string) => Promise<void>
): HeartbeatScheduler {
  const states = new Map<string, HeartbeatAgentState>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;

  function scheduleNext(): void {
    if (!running) return;
    if (timer) clearTimeout(timer);

    let soonest = Infinity;
    for (const s of states.values()) {
      if (!s.config.enabled) continue;
      if (s.nextDueMs < soonest) soonest = s.nextDueMs;
    }

    if (soonest === Infinity) return;

    const delay = Math.max(0, soonest - Date.now());
    timer = setTimeout(fireOverdue, delay);
  }

  async function fireOverdue(): Promise<void> {
    const now = Date.now();
    const overdue: HeartbeatAgentState[] = [];

    for (const s of states.values()) {
      if (!s.config.enabled) continue;
      if (s.nextDueMs <= now) overdue.push(s);
    }

    // Sequential execution to avoid resource contention
    for (const s of overdue) {
      s.lastRunMs = Date.now();
      s.nextDueMs = Date.now() + s.config.intervalMs;
      try {
        await onTick(s.agentId);
      } catch (err) {
        console.error(`[scheduler] tick failed for ${s.agentId}:`, err);
      }
    }

    scheduleNext();
  }

  return {
    addAgent(agentId: string, config: HeartbeatConfig): void {
      states.set(agentId, {
        agentId,
        config,
        nextDueMs: Date.now() + 2_000, // first tick after 2s
        lastRunMs: 0,
      });
      if (running) scheduleNext();
    },

    removeAgent(agentId: string): void {
      states.delete(agentId);
      if (running) scheduleNext();
    },

    updateAgent(agentId: string, config: HeartbeatConfig): void {
      const existing = states.get(agentId);
      if (existing) {
        existing.config = config;
        if (running) scheduleNext();
      }
    },

    getStates(): Map<string, HeartbeatAgentState> {
      return new Map(states);
    },

    start(): void {
      running = true;
      scheduleNext();
    },

    stop(): void {
      running = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
