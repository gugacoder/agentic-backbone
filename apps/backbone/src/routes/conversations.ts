import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { encodeDataStreamEvent } from "./datastream.js";
import {
  sendMessage,
  createSession,
  getSession,
  listSessions,
  updateSession,
  deleteSession,
  readMessages,
  setTakeover,
  releaseTakeover,
} from "../conversations/index.js";
import { eventBus } from "../events/index.js";
import { emitNotification } from "../notifications/index.js";
import { getAuthUser, assertAgentAccess } from "./auth-helpers.js";
import { getAgent } from "../agents/registry.js";
import { parseBody } from "./helpers.js";
import { db } from "../db/index.js";

export const conversationRoutes = new Hono();

function assertSessionOwnership(
  c: Parameters<typeof getAuthUser>[0],
  session: { user_id: string }
): Response | null {
  const auth = getAuthUser(c);
  if (auth.role === "sysuser") return null;
  if (session.user_id !== auth.user) {
    return c.json({ error: "forbidden" }, 403);
  }
  return null;
}

// --- List Conversations ---

conversationRoutes.get("/conversations", (c) => {
  const auth = getAuthUser(c);
  const agentId = c.req.query("agentId") ?? undefined;
  if (auth.role === "sysuser") {
    const userId = c.req.query("userId") ?? undefined;
    return c.json(listSessions(userId, agentId));
  }
  return c.json(listSessions(auth.user, agentId));
});

// --- Create Conversation ---

conversationRoutes.post("/conversations", async (c) => {
  const auth = getAuthUser(c);
  const body = await parseBody<{ agentId?: string }>(c);
  if (body instanceof Response) return body;
  const agentId = body.agentId ?? "system.main";

  const agent = getAgent(agentId);
  if (!agent) return c.json({ error: `Agent '${agentId}' not found` }, 404);

  const agentDenied = assertAgentAccess(c, agentId);
  if (agentDenied) return agentDenied;

  const session = createSession(auth.user, agentId);
  return c.json(session, 201);
});

// --- Get Conversation ---

conversationRoutes.get("/conversations/:sessionId", (c) => {
  const session = getSession(c.req.param("sessionId"));
  if (!session) return c.json({ error: "not found" }, 404);
  const denied = assertSessionOwnership(c, session);
  if (denied) return denied;
  return c.json(session);
});

// --- Get Messages ---

conversationRoutes.get("/conversations/:sessionId/messages", (c) => {
  const sessionId = c.req.param("sessionId");
  const session = getSession(sessionId);
  if (!session) return c.json({ error: "not found" }, 404);
  const denied = assertSessionOwnership(c, session);
  if (denied) return denied;
  const messages = readMessages(session.agent_id, sessionId);

  // Load feedback for this session and attach to messages
  const feedbackRows = db
    .prepare(
      `SELECT message_id, rating, reason FROM message_feedback WHERE session_id = ?`
    )
    .all(sessionId) as { message_id: string; rating: string; reason: string | null }[];
  const feedbackByMessageId = new Map(feedbackRows.map((r) => [r.message_id, { rating: r.rating, reason: r.reason }]));

  const messagesWithFeedback = messages.map((m) => {
    const id = m._meta?.id;
    if (id && feedbackByMessageId.has(id)) {
      return { ...m, feedback: feedbackByMessageId.get(id) };
    }
    return m;
  });

  return c.json(messagesWithFeedback);
});

// --- Update Conversation ---

conversationRoutes.patch("/conversations/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  const session = getSession(sessionId);
  if (!session) return c.json({ error: "not found" }, 404);
  const denied = assertSessionOwnership(c, session);
  if (denied) return denied;
  const body = await c.req.json<{ title?: string; starred?: boolean }>();
  const updated = updateSession(sessionId, body);
  if (!updated) return c.json({ error: "not found" }, 404);
  return c.json(updated);
});

// --- Delete Conversation ---

conversationRoutes.delete("/conversations/:sessionId", (c) => {
  const sessionId = c.req.param("sessionId");
  const session = getSession(sessionId);
  if (!session) return c.json({ error: "not found" }, 404);
  const denied = assertSessionOwnership(c, session);
  if (denied) return denied;
  const deleted = deleteSession(sessionId);
  if (!deleted) return c.json({ error: "not found" }, 404);
  return c.json({ status: "deleted" });
});

// --- Takeover ---

conversationRoutes.post("/conversations/:sessionId/takeover", (c) => {
  const sessionId = c.req.param("sessionId");
  const session = getSession(sessionId);
  if (!session) return c.json({ error: "not found" }, 404);

  const auth = getAuthUser(c);
  const updated = setTakeover(sessionId, auth.user);
  if (!updated) return c.json({ error: "not found" }, 404);

  eventBus.emit("session:takeover", {
    ts: Date.now(),
    sessionId,
    action: "takeover",
    takenOverBy: auth.user,
  });

  emitNotification({
    type: "takeover_started",
    severity: "info",
    title: `Conversa assumida por ${auth.user}`,
    body: `Sessão ${sessionId} está sob controle do operador.`,
    metadata: { sessionId, operatorSlug: auth.user },
  });

  return c.json({
    sessionId,
    takenOverBy: updated.takeover_by,
    takenOverAt: updated.takeover_at,
  });
});

// --- Release ---

conversationRoutes.post("/conversations/:sessionId/release", (c) => {
  const sessionId = c.req.param("sessionId");
  const session = getSession(sessionId);
  if (!session) return c.json({ error: "not found" }, 404);

  const auth = getAuthUser(c);
  const updated = releaseTakeover(sessionId);
  if (!updated) return c.json({ error: "not found" }, 404);

  eventBus.emit("session:takeover", {
    ts: Date.now(),
    sessionId,
    action: "release",
    takenOverBy: null,
  });

  emitNotification({
    type: "takeover_ended",
    severity: "info",
    title: `Conversa devolvida ao agente`,
    body: `Sessão ${sessionId} foi devolvida ao agente por ${auth.user}.`,
    metadata: { sessionId, operatorSlug: auth.user },
  });

  return c.json({ sessionId, released: true });
});

// --- Send Message (streaming) ---

conversationRoutes.post("/conversations/:sessionId/messages", async (c) => {
  const sessionId = c.req.param("sessionId");
  const session = getSession(sessionId);
  if (!session) return c.json({ error: "not found" }, 404);
  const denied = assertSessionOwnership(c, session);
  if (denied) return denied;

  const auth = getAuthUser(c);
  const body = await c.req.json<{ message?: string; messages?: Array<{ role: string; content: string }> }>();

  // Support both legacy { message } and @ai-sdk/react { messages } formats
  const message = body.message ?? body.messages?.filter((m) => m.role === "user").pop()?.content;

  if (!message) {
    return c.json({ error: "message is required" }, 400);
  }

  const format = c.req.query("format");

  if (format === "datastream") {
    // @ai-sdk/react useChat reads the raw body stream (no SSE framing).
    // Each line must be a bare data-stream-protocol line: "0:\"text\"\n"
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of sendMessage(auth.user, sessionId, message)) {
            try {
              const encoded = encodeDataStreamEvent(event);
              if (encoded !== null) {
                controller.enqueue(encoder.encode(encoded + "\n"));
              }
            } catch (encodeErr) {
              console.error(`[datastream] error encoding event:`, encodeErr);
            }
          }
        } catch (err) {
          console.error(`[datastream] stream error:`, err);
        } finally {
          controller.close();
        }
      },
    });
    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }

  return streamSSE(c, async (stream) => {
    for await (const event of sendMessage(auth.user, sessionId, message)) {
      await stream.writeSSE({ data: JSON.stringify(event) });
    }
  });
});

// --- Export Conversation ---

conversationRoutes.get("/conversations/:sessionId/export", (c) => {
  const sessionId = c.req.param("sessionId");
  const session = getSession(sessionId);
  if (!session) return c.json({ error: "not found" }, 404);
  const denied = assertSessionOwnership(c, session);
  if (denied) return denied;

  const messages = readMessages(session.agent_id, sessionId);
  const format = c.req.query("format") ?? "json";

  if (format === "markdown") {
    let md = `# Conversation: ${session.title ?? sessionId}\n\n`;
    md += `Created: ${session.created_at}\n\n---\n\n`;
    for (const msg of messages) {
      const ts = msg._meta?.ts ?? "";
      const text = typeof msg.content === "string"
        ? msg.content
        : (msg.content as any[]).filter((p: any) => p.type === "text").map((p: any) => p.text).join("");
      md += `**${msg.role}** (${ts}):\n\n${text}\n\n---\n\n`;
    }
    return new Response(md, {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="conversation-${sessionId}.md"`,
      },
    });
  }

  return new Response(JSON.stringify({ session, messages }), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="conversation-${sessionId}.json"`,
    },
  });
});
