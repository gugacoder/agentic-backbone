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

export { readMessages };

export interface Session {
  session_id: string;
  user_id: string;
  agent_id: string;
  channel_id: string | null;
  sdk_session_id: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
}

// --- Prepared statements ---

const insertSession = db.prepare(
  `INSERT INTO sessions (session_id, user_id, agent_id, channel_id) VALUES (?, ?, ?, ?)`
);

const selectSession = db.prepare(
  `SELECT session_id, user_id, agent_id, channel_id, sdk_session_id, title, created_at, updated_at
   FROM sessions WHERE session_id = ?`
);

const setSdkSessionId = db.prepare(
  `UPDATE sessions SET sdk_session_id = ?, updated_at = datetime('now')
   WHERE session_id = ?`
);

const selectAllSessions = db.prepare(
  `SELECT session_id, user_id, agent_id, channel_id, sdk_session_id, title, created_at, updated_at
   FROM sessions ORDER BY updated_at DESC`
);

const selectSessionsByUser = db.prepare(
  `SELECT session_id, user_id, agent_id, channel_id, sdk_session_id, title, created_at, updated_at
   FROM sessions WHERE user_id = ? ORDER BY updated_at DESC`
);

const selectSessionsByUserAndAgent = db.prepare(
  `SELECT session_id, user_id, agent_id, channel_id, sdk_session_id, title, created_at, updated_at
   FROM sessions WHERE user_id = ? AND agent_id = ? ORDER BY updated_at DESC`
);

const selectSessionsByAgent = db.prepare(
  `SELECT session_id, user_id, agent_id, channel_id, sdk_session_id, title, created_at, updated_at
   FROM sessions WHERE agent_id = ? ORDER BY updated_at DESC`
);

const findSessionByChannelKey = db.prepare(
  `SELECT session_id, user_id, agent_id, channel_id, sdk_session_id, title, created_at, updated_at
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

  const prompt = await assemblePrompt(agentId, "conversation", { userMessage: message }) ?? "";

  let fullText = "";
  let sdkSessionId = session.sdk_session_id ?? undefined;
  const agentStartMs = Date.now();

  await triggerHook({
    ts: Date.now(),
    hookEvent: "agent:before",
    agentId,
    role: "conversation",
    sessionId,
    prompt,
  });

  for await (const event of runAgent(prompt, {
    sessionId: sdkSessionId,
    role: "conversation",
    tools: composeAgentTools(agentId, "conversation"),
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
