import { assemblePrompt } from "../context/index.js";
import { runAgent } from "../agent/index.js";
import { eventBus } from "../events/index.js";
import { deliverToSystemChannel, deliverToChannel } from "../channels/system-channel.js";
import { resolveLastActiveChannel } from "../conversations/index.js";
import { listAgents } from "../agents/registry.js";
import { isWithinActiveHours } from "./active-hours.js";
import { createHeartbeatScheduler, type HeartbeatScheduler } from "./scheduler.js";
import { logHeartbeat } from "./log.js";
import { triggerHook } from "../hooks/index.js";
import { composeAgentTools } from "../agent/tools.js";
import { collectAgentResult } from "../utils/agent-stream.js";
import { formatError } from "../utils/errors.js";
import { emitNotification } from "../notifications/index.js";

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

// --- Tick helpers ---

function skipWithReason(state: HeartbeatState, agentId: string, reason: SkipReason): void {
  state.lastStatus = "skipped";
  state.lastSkipReason = reason;
  logHeartbeat({ agentId, status: "skipped", reason });
  eventBus.emit("heartbeat:status", { ts: Date.now(), agentId, status: "skipped", reason });
}

function emitHeartbeatResult(agentId: string, status: string, extras: Record<string, unknown>): void {
  logHeartbeat({ agentId, status, ...extras });
  eventBus.emit("heartbeat:status", { ts: Date.now(), agentId, status, ...extras } as any);
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
    skipWithReason(state, agentId, "agent-disabled");
    return;
  }

  // Guard: active hours
  if (agentConfig?.heartbeat.activeHours) {
    if (!isWithinActiveHours(agentConfig.heartbeat.activeHours)) {
      skipWithReason(state, agentId, "quiet-hours");
      return;
    }
  }

  // Guard: empty instructions
  const assembled = await assemblePrompt(agentId, "heartbeat");
  if (!assembled) {
    skipWithReason(state, agentId, "empty-instructions");
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
    await triggerHook({
      ts: Date.now(),
      hookEvent: "agent:before",
      agentId,
      role: "heartbeat",
      prompt: assembled.userMessage,
    });

    const { fullText, usage: usageData } = await collectAgentResult(
      runAgent(assembled.userMessage, {
        role: "heartbeat",
        tools: composeAgentTools(agentId, "heartbeat"),
        system: assembled.system,
      })
    );

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
      emitHeartbeatResult(agentId, "ok-token", { durationMs, usage: usageData });
      return;
    }

    if (isDuplicate(state, cleanText)) {
      state.lastStatus = "skipped";
      state.lastSkipReason = "duplicate";
      console.log(`[heartbeat:${agentId}] suppressed duplicate (${durationMs}ms)`);
      emitHeartbeatResult(agentId, "skipped", { durationMs, usage: usageData, reason: "duplicate" });
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
    emitHeartbeatResult(agentId, "sent", { preview, durationMs, usage: usageData });
    const deliveryMode = agentConfig?.delivery;
    if (deliveryMode === "last-active") {
      const lastChannel = resolveLastActiveChannel(agentId, agentConfig.owner);
      if (lastChannel) {
        await deliverToChannel(lastChannel, agentId, cleanText);
      } else {
        deliverToSystemChannel(agentId, cleanText);
      }
    } else if (deliveryMode && deliveryMode !== "system-channel") {
      await deliverToChannel(deliveryMode, agentId, cleanText);
    } else {
      deliverToSystemChannel(agentId, cleanText);
    }
  } catch (err) {
    const reason = formatError(err);
    const durationMs = Date.now() - startMs;
    state.lastStatus = "failed";
    console.error(`[heartbeat:${agentId}] failed:`, err);
    emitHeartbeatResult(agentId, "failed", { reason, durationMs });
    emitNotification({
      type: "heartbeat_error",
      severity: "error",
      agentId,
      title: `Heartbeat falhou: ${agentId}`,
      body: reason,
      metadata: { durationMs },
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
