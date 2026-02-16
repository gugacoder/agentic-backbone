import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
  sendMessage,
  createSession,
  getSession,
  listSessions,
  updateSession,
  deleteSession,
  readMessages,
} from "../conversations/index.js";
import { getAuthUser } from "./auth-helpers.js";
import { getAgent } from "../agents/registry.js";

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
  const body = await c.req.json<{ agentId?: string }>().catch(() => ({} as { agentId?: string }));
  const agentId = body.agentId ?? "system.main";

  const agent = getAgent(agentId);
  if (!agent) return c.json({ error: `Agent '${agentId}' not found` }, 404);

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
  return c.json(messages);
});

// --- Update Conversation ---

conversationRoutes.patch("/conversations/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  const session = getSession(sessionId);
  if (!session) return c.json({ error: "not found" }, 404);
  const denied = assertSessionOwnership(c, session);
  if (denied) return denied;
  const body = await c.req.json<{ title?: string }>();
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

// --- Send Message (streaming) ---

conversationRoutes.post("/conversations/:sessionId/messages", async (c) => {
  const sessionId = c.req.param("sessionId");
  const session = getSession(sessionId);
  if (!session) return c.json({ error: "not found" }, 404);
  const denied = assertSessionOwnership(c, session);
  if (denied) return denied;

  const auth = getAuthUser(c);
  const { message } = await c.req.json<{ message: string }>();

  if (!message) {
    return c.json({ error: "message is required" }, 400);
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
      md += `**${msg.role}** (${msg.ts}):\n\n${msg.content}\n\n---\n\n`;
    }
    return new Response(md, {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="conversation-${sessionId}.md"`,
      },
    });
  }

  return c.json({ session, messages });
});
