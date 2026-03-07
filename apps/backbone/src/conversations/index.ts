import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { assemblePrompt } from "../context/index.js";
import { runAgent, type AgentEvent } from "../agent/index.js";
import {
  initSession as initPersistentSession,
  appendMessage,
  updateSessionMetadata,
  readMessages,
} from "./persistence.js";
import { flushMemory } from "../memory/flush.js";
import { composeAgentTools } from "../agent/tools.js";
import { getAgent } from "../agents/registry.js";
import { triggerHook } from "../hooks/index.js";
import { trackCost } from "../db/costs.js";
import { trackConversation } from "../db/analytics.js";
import type { UsageData } from "../agent/index.js";
import { checkMessageSecurity } from "../security/filter.js";

export { readMessages };

export interface Session {
  session_id: string;
  user_id: string;
  agent_id: string;
  channel_id: string | null;
  sdk_session_id: string | null;
  title: string | null;
  takeover_by: string | null;
  takeover_at: string | null;
  created_at: string;
  updated_at: string;
}

// --- Prepared statements ---

const insertSession = db.prepare(
  `INSERT INTO sessions (session_id, user_id, agent_id, channel_id) VALUES (?, ?, ?, ?)`
);

const selectSession = db.prepare(
  `SELECT session_id, user_id, agent_id, channel_id, sdk_session_id, title, takeover_by, takeover_at, created_at, updated_at
   FROM sessions WHERE session_id = ?`
);

const setSdkSessionId = db.prepare(
  `UPDATE sessions SET sdk_session_id = ?, updated_at = datetime('now')
   WHERE session_id = ?`
);

const selectAllSessions = db.prepare(
  `SELECT session_id, user_id, agent_id, channel_id, sdk_session_id, title, takeover_by, takeover_at, created_at, updated_at
   FROM sessions ORDER BY updated_at DESC`
);

const selectSessionsByUser = db.prepare(
  `SELECT session_id, user_id, agent_id, channel_id, sdk_session_id, title, takeover_by, takeover_at, created_at, updated_at
   FROM sessions WHERE user_id = ? ORDER BY updated_at DESC`
);

const selectSessionsByUserAndAgent = db.prepare(
  `SELECT session_id, user_id, agent_id, channel_id, sdk_session_id, title, takeover_by, takeover_at, created_at, updated_at
   FROM sessions WHERE user_id = ? AND agent_id = ? ORDER BY updated_at DESC`
);

const selectSessionsByAgent = db.prepare(
  `SELECT session_id, user_id, agent_id, channel_id, sdk_session_id, title, takeover_by, takeover_at, created_at, updated_at
   FROM sessions WHERE agent_id = ? ORDER BY updated_at DESC`
);

const findSessionByChannelKey = db.prepare(
  `SELECT session_id, user_id, agent_id, channel_id, sdk_session_id, title, takeover_by, takeover_at, created_at, updated_at
   FROM sessions WHERE agent_id = ? AND user_id = ? AND channel_id = ?
   ORDER BY updated_at DESC LIMIT 1`
);

const lastActiveChannel = db.prepare(
  `SELECT channel_id FROM sessions
   WHERE agent_id = ? AND user_id = ? AND channel_id IS NOT NULL
   ORDER BY updated_at DESC LIMIT 1`
);

const updateSessionTitle = db.prepare(
  `UPDATE sessions SET title = ?, updated_at = datetime('now')
   WHERE session_id = ?`
);

const deleteSessionStmt = db.prepare(
  `DELETE FROM sessions WHERE session_id = ?`
);

const setTakeoverStmt = db.prepare(
  `UPDATE sessions SET takeover_by = ?, takeover_at = datetime('now'), updated_at = datetime('now')
   WHERE session_id = ?`
);

const clearTakeoverStmt = db.prepare(
  `UPDATE sessions SET takeover_by = NULL, takeover_at = NULL, updated_at = datetime('now')
   WHERE session_id = ?`
);

// --- Message counter for flush ---

const messageCounters = new Map<string, number>();

const FLUSH_EVERY = 20;

// --- API ---

export function createSession(userId: string, agentId = "system.main", channelId?: string): Session {
  const sessionId = randomUUID();
  insertSession.run(sessionId, userId, agentId, channelId ?? null);

  // Persist session to filesystem
  initPersistentSession(agentId, sessionId, userId);

  const now = new Date().toISOString();
  return {
    session_id: sessionId,
    user_id: userId,
    agent_id: agentId,
    channel_id: channelId ?? null,
    sdk_session_id: null,
    title: null,
    takeover_by: null,
    takeover_at: null,
    created_at: now,
    updated_at: now,
  };
}

export function getSession(sessionId: string): Session | null {
  return (selectSession.get(sessionId) as Session) ?? null;
}

export function listSessions(userId?: string, agentId?: string): Session[] {
  if (userId && agentId) {
    return selectSessionsByUserAndAgent.all(userId, agentId) as Session[];
  }
  if (userId) {
    return selectSessionsByUser.all(userId) as Session[];
  }
  if (agentId) {
    return selectSessionsByAgent.all(agentId) as Session[];
  }
  return selectAllSessions.all() as Session[];
}

export function updateSession(
  sessionId: string,
  updates: { title?: string }
): Session | null {
  const session = getSession(sessionId);
  if (!session) return null;

  if (updates.title !== undefined) {
    updateSessionTitle.run(updates.title, sessionId);
  }

  return getSession(sessionId);
}

export function deleteSession(sessionId: string): boolean {
  const result = deleteSessionStmt.run(sessionId);
  return result.changes > 0;
}

export function setTakeover(sessionId: string, operatorSlug: string): Session | null {
  setTakeoverStmt.run(operatorSlug, sessionId);
  return getSession(sessionId);
}

export function releaseTakeover(sessionId: string): Session | null {
  clearTakeoverStmt.run(sessionId);
  return getSession(sessionId);
}

export function findOrCreateSession(agentId: string, userId: string, channelId: string): Session {
  const existing = findSessionByChannelKey.get(agentId, userId, channelId) as Session | undefined;
  if (existing) return existing;
  return createSession(userId, agentId, channelId);
}

export function resolveLastActiveChannel(agentId: string, userId: string): string | null {
  const row = lastActiveChannel.get(agentId, userId) as { channel_id: string } | undefined;
  return row?.channel_id ?? null;
}

export async function* sendMessage(
  userId: string,
  sessionId: string,
  message: string
): AsyncGenerator<AgentEvent> {
  const session = getSession(sessionId);
  if (!session) {
    throw new Error("Session not found");
  }

  const agentId = session.agent_id;

  const agent = getAgent(agentId);
  if (!agent) {
    throw new Error(`Agent ${agentId} not found`);
  }

  // Takeover: session is under operator control
  if (session.takeover_by !== null) {
    const isOperator = userId === session.takeover_by;

    if (isOperator) {
      // Operator message: saved as assistant with operator metadata, no agent
      appendMessage(agentId, sessionId, {
        ts: new Date().toISOString(),
        role: "assistant",
        content: message,
        metadata: { operator: true, operatorSlug: userId },
      });

      await triggerHook({
        ts: Date.now(),
        hookEvent: "message:sent",
        userId,
        sessionId,
        content: message,
      });

      yield { type: "result", content: message };
      return;
    } else {
      // External user message during takeover: saved normally, no agent
      appendMessage(agentId, sessionId, {
        ts: new Date().toISOString(),
        role: "user",
        content: message,
      });

      await triggerHook({
        ts: Date.now(),
        hookEvent: "message:received",
        userId,
        sessionId,
        message,
      });

      return;
    }
  }

  // Persist user message
  appendMessage(agentId, sessionId, {
    ts: new Date().toISOString(),
    role: "user",
    content: message,
  });

  await triggerHook({
    ts: Date.now(),
    hookEvent: "message:received",
    userId,
    sessionId,
    message,
  });

  // Security filter — check before running agent
  const securityResult = await checkMessageSecurity(message, agentId, sessionId);
  if (securityResult.action === "blocked") {
    const errorMsg = "Mensagem nao permitida pelo sistema de seguranca.";
    appendMessage(agentId, sessionId, {
      ts: new Date().toISOString(),
      role: "assistant",
      content: errorMsg,
    });
    yield { type: "result", content: errorMsg };
    return;
  }
  // flagged: continue to agent, already logged in security_events

  const assembled = await assemblePrompt(agentId, "conversation", { userMessage: message });
  if (!assembled) {
    throw new Error(`Agent ${agentId} has no conversation instructions`);
  }

  let fullText = "";
  let sdkSessionId = session.sdk_session_id ?? undefined;
  let usageData: UsageData | undefined;
  const agentStartMs = Date.now();

  await triggerHook({
    ts: Date.now(),
    hookEvent: "agent:before",
    agentId,
    role: "conversation",
    sessionId,
    prompt: assembled.userMessage,
  });

  for await (const event of runAgent(assembled.userMessage, {
    sessionId: sdkSessionId,
    role: "conversation",
    tools: composeAgentTools(agentId, "conversation", { sessionId, userId }),
    system: assembled.system,
  })) {
    // Capture SDK session on first init for future resume
    if (event.type === "init" && event.sessionId) {
      setSdkSessionId.run(event.sessionId, sessionId);
      sdkSessionId = event.sessionId;
    }

    if (event.type === "text" && event.content) {
      fullText += event.content;
    }
    if (event.type === "result" && event.content) {
      fullText = event.content;
    }
    if (event.type === "usage" && event.usage) {
      usageData = event.usage as UsageData;
    }

    yield event;
  }

  await triggerHook({
    ts: Date.now(),
    hookEvent: "agent:after",
    agentId,
    role: "conversation",
    sessionId,
    resultText: fullText,
    durationMs: Date.now() - agentStartMs,
  });

  if (usageData) {
    trackCost({
      agentId,
      operation: "conversation",
      tokensIn: usageData.inputTokens,
      tokensOut: usageData.outputTokens,
      costUsd: usageData.totalCostUsd,
    });
  }

  const durationMs = Date.now() - agentStartMs;
  trackConversation({
    agentId,
    messagesIn: 1,
    messagesOut: fullText ? 1 : 0,
    durationMs,
  });

  // Persist assistant message
  if (fullText) {
    appendMessage(agentId, sessionId, {
      ts: new Date().toISOString(),
      role: "assistant",
      content: fullText,
    });

    await triggerHook({
      ts: Date.now(),
      hookEvent: "message:sent",
      userId,
      sessionId,
      content: fullText,
    });
  }

  // Update session metadata
  const count = (messageCounters.get(sessionId) ?? 0) + 1;
  messageCounters.set(sessionId, count);
  updateSessionMetadata(agentId, sessionId, {
    "message-count": count,
    "last-activity": new Date().toISOString(),
  });

  // Periodic memory flush (non-blocking)
  if (count % FLUSH_EVERY === 0) {
    flushMemory({
      agentId,
      sdkSessionId,
    }).catch((err) => {
      console.warn("[memory-flush] background flush failed:", err);
    });
  }
}
