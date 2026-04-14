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
  setTakeover,
  releaseTakeover,
} from "../conversations/index.js";
import { readMessagesPaginated } from "../conversations/cli-history.js";
import { eventBus } from "../events/index.js";
import { emitNotification } from "../notifications/index.js";
import { getAuthUser, assertAgentAccess } from "./auth-helpers.js";
import { getAgent } from "../agents/registry.js";
import { parseBody } from "./helpers.js";
import { db } from "../db/index.js";
import { join, extname } from "node:path";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { agentDir } from "../context/paths.js";
import {
  MIME_LIMITS,
  ACCEPTED_MIME_TYPES,
  TOTAL_SIZE_LIMIT,
  MAX_FILES,
  saveAttachment,
} from "../conversations/attachments.js";

const ATTACHMENT_MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".webm": "audio/webm",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".json": "application/json",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export const conversationRoutes = new Hono();

/** Normalize session for API response — starred as boolean */
function normalizeSession(s: Record<string, unknown>): Record<string, unknown> {
  return { ...s, starred: Boolean(s.starred) };
}

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
    return c.json(listSessions(userId, agentId).map(normalizeSession));
  }
  return c.json(listSessions(auth.user, agentId).map(normalizeSession));
});

// --- Create Conversation ---

conversationRoutes.post("/conversations", async (c) => {
  const auth = getAuthUser(c);
  const body = await parseBody<{ agentId?: string; multiAgent?: boolean }>(c);
  if (body instanceof Response) return body;
  const agentId = body.agentId ?? "system.main";

  const agent = getAgent(agentId);
  if (!agent) return c.json({ error: `Agent '${agentId}' not found` }, 404);

  const agentDenied = assertAgentAccess(c, agentId);
  if (agentDenied) return agentDenied;

  const session = createSession(auth.user, agentId, { multiAgent: body.multiAgent });
  return c.json(normalizeSession(session as unknown as Record<string, unknown>), 201);
});

// --- Get Conversation ---

conversationRoutes.get("/conversations/:sessionId", (c) => {
  const session = getSession(c.req.param("sessionId"));
  if (!session) return c.json({ error: "not found" }, 404);
  const denied = assertSessionOwnership(c, session);
  if (denied) return denied;
  return c.json(normalizeSession(session as unknown as Record<string, unknown>));
});

// --- Get Messages (paginated, cursor-based reverse) ---

conversationRoutes.get("/conversations/:sessionId/messages", (c) => {
  const sessionId = c.req.param("sessionId");
  const session = getSession(sessionId);
  if (!session) return c.json({ error: "not found" }, 404);
  const denied = assertSessionOwnership(c, session);
  if (denied) return denied;

  const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10) || 50, 200);
  const before = c.req.query("before") ?? undefined;

  const result = readMessagesPaginated(session.agent_id, sessionId, limit, before);

  return c.json(result);
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
  return c.json(normalizeSession(updated as unknown as Record<string, unknown>));
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
  const ct = c.req.header("content-type") ?? "";

  let message: string | undefined;
  let overrideAgentId: string | undefined;

  if (ct.includes("multipart/form-data")) {
    const body = await c.req.parseBody({ all: true });

    // Extract per-message agent override
    const rawAgentId = body["agentId"];
    if (typeof rawAgentId === "string" && rawAgentId.trim().length > 0) {
      overrideAgentId = rawAgentId.trim();
    }

    // Extract text message
    const rawMessage = body["message"];
    message = typeof rawMessage === "string" && rawMessage.trim().length > 0
      ? rawMessage
      : undefined;

    // Normalize files field to File[]
    const rawFiles = body["files"];
    const files: File[] =
      rawFiles === undefined
        ? []
        : Array.isArray(rawFiles)
        ? (rawFiles.filter((f) => f instanceof File) as File[])
        : rawFiles instanceof File
        ? [rawFiles]
        : [];

    // At least one of message or files must be present
    if (!message && files.length === 0) {
      return c.json({ error: "At least one of 'message' or 'files' must be provided" }, 400);
    }

    if (files.length > 0) {
      // Max files
      if (files.length > MAX_FILES) {
        return c.json(
          { error: `Too many files: maximum ${MAX_FILES} files per message` },
          413
        );
      }

      // Validate MIME types
      for (const file of files) {
        if (!ACCEPTED_MIME_TYPES.has(file.type)) {
          return c.json(
            {
              error: `Unsupported media type: ${file.type}`,
              acceptedTypes: Array.from(ACCEPTED_MIME_TYPES),
            },
            415
          );
        }
      }

      // Validate individual file sizes
      for (const file of files) {
        const limit = MIME_LIMITS[file.type];
        if (limit !== undefined && file.size > limit) {
          const limitMB = Math.round(limit / (1024 * 1024));
          return c.json(
            {
              error: `File '${file.name}' (${file.type}) exceeds the ${limitMB}MB size limit`,
            },
            413
          );
        }
      }

      // Validate total size
      const totalSize = files.reduce((sum, f) => sum + f.size, 0);
      if (totalSize > TOTAL_SIZE_LIMIT) {
        const limitMB = Math.round(TOTAL_SIZE_LIMIT / (1024 * 1024));
        return c.json(
          { error: `Total upload size exceeds the ${limitMB}MB limit per message` },
          413
        );
      }

      // Save files to {sessionDir}/attachments/
      const sessionDir = join(agentDir(session.agent_id), "conversations", sessionId);
      for (const file of files) {
        await saveAttachment(sessionDir, file);
      }
    }

    // If only files provided, use empty string as placeholder until F-331
    if (!message) message = "";
  } else {
    // JSON path — retrocompatible
    const body = await c.req.json<{
      message?: string;
      messages?: Array<{ role: string; content: string }>;
      agentId?: string;
    }>();

    // Support both legacy { message } and @ai-sdk/react { messages } formats
    message = body.message ?? body.messages?.filter((m) => m.role === "user").pop()?.content;
    overrideAgentId = body.agentId;

    if (!message) {
      return c.json({ error: "message is required" }, 400);
    }
  }

  // At this point message is always a string (both branches either assign or return early)
  const effectiveMessage = message as string;

  // Validate override agent exists
  if (overrideAgentId) {
    const overrideAgent = getAgent(overrideAgentId);
    if (!overrideAgent) {
      return c.json({ error: `Agent '${overrideAgentId}' not found` }, 404);
    }
    const agentDenied = assertAgentAccess(c, overrideAgentId);
    if (agentDenied) return agentDenied;
  }

  const rich = c.req.query("rich") === "true";

  // SSE nativo com SDKMessage — formato compatível com useOpenClaudeChat (milestone 25, D-01)
  return streamSSE(c, async (stream) => {
    for await (const msg of sendMessage(auth.user, sessionId, effectiveMessage, { rich, agentId: overrideAgentId })) {
      await stream.writeSSE({ event: "message", data: JSON.stringify(msg) });
    }
    await stream.writeSSE({ event: "done", data: JSON.stringify({}) });
  });
});

// --- Get Attachment ---

conversationRoutes.get("/conversations/:sessionId/attachments/:filename", async (c) => {
  const sessionId = c.req.param("sessionId");
  const filename = c.req.param("filename");

  // Sanitize: reject path traversal attempts
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return c.json({ error: "Invalid filename" }, 400);
  }

  const session = getSession(sessionId);
  if (!session) return c.json({ error: "not found" }, 404);

  const sessionDir = join(agentDir(session.agent_id), "conversations", sessionId);
  const filePath = join(sessionDir, "attachments", filename);

  if (!existsSync(filePath)) {
    return c.json({ error: "not found" }, 404);
  }

  const ext = extname(filename).toLowerCase();
  const contentType = ATTACHMENT_MIME_MAP[ext] ?? "application/octet-stream";
  const stat = statSync(filePath);
  const data = await readFile(filePath);

  return new Response(data, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
      "Cache-Control": "private, max-age=3600",
    },
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
