import { assemblePrompt } from "../context/index.js";
import { runAgent, type UsageData } from "../agent/index.js";
import { eventBus } from "../events/index.js";
import { deliverToSystemChannel, deliverToChannel } from "../channels/system-channel.js";
import { listAgents } from "../agents/registry.js";
import { isWithinActiveHours } from "./active-hours.js";
import { createHeartbeatScheduler, type HeartbeatScheduler } from "./scheduler.js";
import { logHeartbeat } from "./log.js";
import { triggerHook } from "../hooks/index.js";
import { jobsMcpServer } from "../jobs/tools.js";
import { agentDir } from "../context/paths.js";

const HEARTBEAT_OK = "HEARTBEAT_OK";
const ACK_MAX_CHARS = 300;
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

type SkipReason =
  | "agent-disabled"
  | "empty-instructions"
  | "already-running"
  | "duplicate"
  | "quiet-hours";

interface HeartbeatState {
  running: boolean;
  lastText: string | null;
  lastSentAt: number | null;
  lastStatus: "ok" | "sent" | "skipped" | "failed" | null;
  lastSkipReason: SkipReason | null;
}

const agentStates = new Map<string, HeartbeatState>();

function getOrCreateState(agentId: string): HeartbeatState {
  let s = agentStates.get(agentId);
  if (!s) {
    s = {
      running: false,
      lastText: null,
      lastSentAt: null,
      lastStatus: null,
      lastSkipReason: null,
    };
    agentStates.set(agentId, s);
  }
  return s;
}

// --- HEARTBEAT_OK token processing ---

function normalizeReply(text: string): {
  shouldSkip: boolean;
  cleanText: string;
} {
  const cleaned = text
    .replace(/<[^>]*>HEARTBEAT_OK<\/[^>]*>/g, "")
    .replace(/\*{1,2}HEARTBEAT_OK\*{1,2}/g, "")
    .replace(/^HEARTBEAT_OK\s*/g, "")
    .replace(/\s*HEARTBEAT_OK$/g, "")
    .trim();

  return {
    shouldSkip: cleaned.length <= ACK_MAX_CHARS,
    cleanText: cleaned,
  };
}

// --- Duplicate suppression ---

function isDuplicate(state: HeartbeatState, text: string): boolean {
  if (!state.lastText || !state.lastSentAt) return false;
  const withinWindow = Date.now() - state.lastSentAt < DEDUP_WINDOW_MS;
  return withinWindow && text === state.lastText;
}

// --- Tick (per agent) ---

async function tick(agentId: string): Promise<void> {
  const state = getOrCreateState(agentId);

  // Guard: serialization
  if (state.running) {
    state.lastSkipReason = "already-running";
    logHeartbeat({ agentId, status: "skipped", reason: "already-running" });
    return;
  }

  // Guard: agent enabled
  const agents = listAgents();
  const agentConfig = agents.find((a) => a.id === agentId);
  if (!agentConfig?.enabled) {
    state.lastStatus = "skipped";
    state.lastSkipReason = "agent-disabled";
    logHeartbeat({ agentId, status: "skipped", reason: "agent-disabled" });
    eventBus.emit("heartbeat:status", {
      ts: Date.now(),
      agentId,
      status: "skipped",
      reason: "agent-disabled",
    });
    return;
  }

  // Guard: active hours
  if (agentConfig?.heartbeat.activeHours) {
    if (!isWithinActiveHours(agentConfig.heartbeat.activeHours)) {
      state.lastStatus = "skipped";
      state.lastSkipReason = "quiet-hours";
      logHeartbeat({ agentId, status: "skipped", reason: "quiet-hours" });
      eventBus.emit("heartbeat:status", {
        ts: Date.now(),
        agentId,
        status: "skipped",
        reason: "quiet-hours",
      });
      return;
    }
  }

  // Guard: empty instructions
  const prompt = await assemblePrompt(agentId, "heartbeat");
  if (!prompt) {
    state.lastStatus = "skipped";
    state.lastSkipReason = "empty-instructions";
    logHeartbeat({ agentId, status: "skipped", reason: "empty-instructions" });
    eventBus.emit("heartbeat:status", {
      ts: Date.now(),
      agentId,
      status: "skipped",
      reason: "empty-instructions",
    });
    return;
  }

  state.running = true;
  const startMs = Date.now();

  // Expose agent identity to child processes (used by job tools)
  process.env.AGENT_ID = agentId;

  await triggerHook({
    ts: Date.now(),
    hookEvent: "heartbeat:before",
    agentId,
  });

  try {
    let fullText = "";
    let usageData: UsageData | undefined;

    await triggerHook({
      ts: Date.now(),
      hookEvent: "agent:before",
      agentId,
      role: "heartbeat",
      prompt,
    });

    for await (const event of runAgent(prompt, {
      role: "heartbeat",
      mcpServers: { "backbone-jobs": jobsMcpServer },
    })) {
      if (event.type === "result" && event.content) {
        fullText = event.content;
      } else if (event.type === "text" && event.content) {
        fullText += event.content;
      } else if (event.type === "usage" && event.usage) {
        usageData = event.usage;
      }
    }

    await triggerHook({
      ts: Date.now(),
      hookEvent: "agent:after",
      agentId,
      role: "heartbeat",
      resultText: fullText,
      durationMs: Date.now() - startMs,
    });

    const { shouldSkip, cleanText } = normalizeReply(fullText);
    const durationMs = Date.now() - startMs;

    if (shouldSkip) {
      state.lastStatus = "ok";
      console.log(`[heartbeat:${agentId}] ok (${durationMs}ms)`);
      logHeartbeat({ agentId, status: "ok-token", durationMs, usage: usageData });
      eventBus.emit("heartbeat:status", {
        ts: Date.now(),
        agentId,
        status: "ok-token",
        durationMs,
        usage: usageData,
      });
      return;
    }

    if (isDuplicate(state, cleanText)) {
      state.lastStatus = "skipped";
      state.lastSkipReason = "duplicate";
      console.log(`[heartbeat:${agentId}] suppressed duplicate (${durationMs}ms)`);
      logHeartbeat({ agentId, status: "skipped", durationMs, usage: usageData, reason: "duplicate" });
      eventBus.emit("heartbeat:status", {
        ts: Date.now(),
        agentId,
        status: "skipped",
        reason: "duplicate",
        durationMs,
        usage: usageData,
      });
      return;
    }

    // Deliver
    const preview = cleanText.slice(0, 200);
    state.lastText = cleanText;
    state.lastSentAt = Date.now();
    state.lastStatus = "sent";
    console.log(
      `[heartbeat:${agentId}] delivered (${durationMs}ms): ${preview}`
    );
    logHeartbeat({ agentId, status: "sent", durationMs, usage: usageData, preview });
    eventBus.emit("heartbeat:status", {
      ts: Date.now(),
      agentId,
      status: "sent",
      preview,
      durationMs,
      usage: usageData,
    });
    const deliveryChannel = agentConfig?.delivery;
    if (deliveryChannel && deliveryChannel !== "system-channel") {
      deliverToChannel(deliveryChannel, agentId, cleanText);
    } else {
      deliverToSystemChannel(agentId, cleanText);
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startMs;
    state.lastStatus = "failed";
    console.error(`[heartbeat:${agentId}] failed:`, err);
    logHeartbeat({ agentId, status: "failed", durationMs, reason });
    eventBus.emit("heartbeat:status", {
      ts: Date.now(),
      agentId,
      status: "failed",
      reason,
      durationMs,
    });
  } finally {
    state.running = false;
  }
}

// --- Scheduler ---

let scheduler: HeartbeatScheduler | null = null;

// --- Public API ---

export function getHeartbeatStatus(): Record<string, HeartbeatState> {
  const result: Record<string, HeartbeatState> = {};
  for (const [id, state] of agentStates) {
    result[id] = { ...state };
  }
  return result;
}

export function startHeartbeat(): void {
  scheduler = createHeartbeatScheduler(tick);

  const agents = listAgents();
  let registered = 0;

  for (const agent of agents) {
    if (agent.enabled && agent.heartbeat.enabled) {
      scheduler.addAgent(agent.id, agent.heartbeat);
      registered++;
      console.log(
        `[heartbeat] registered ${agent.id} (interval: ${agent.heartbeat.intervalMs}ms)`
      );
    }
  }

  if (registered === 0) {
    console.log("[heartbeat] no heartbeat-enabled agents found");
  }

  scheduler.start();
  console.log(`[heartbeat] started (${registered} agent(s))`);
}

export function stopHeartbeat(): void {
  if (scheduler) {
    scheduler.stop();
    scheduler = null;
  }
}

export function getSchedulerStates(): Map<string, import("./scheduler.js").HeartbeatAgentState> {
  if (!scheduler) return new Map();
  return scheduler.getStates();
}

export function updateHeartbeatAgent(
  agentId: string,
  config: import("../agents/types.js").HeartbeatConfig
): void {
  if (!scheduler) return;
  const states = scheduler.getStates();
  if (states.has(agentId)) {
    scheduler.updateAgent(agentId, config);
  } else if (config.enabled) {
    scheduler.addAgent(agentId, config);
  }
  if (!config.enabled && states.has(agentId)) {
    scheduler.removeAgent(agentId);
  }
}

export async function triggerManualHeartbeat(agentId: string): Promise<void> {
  await tick(agentId);
}
