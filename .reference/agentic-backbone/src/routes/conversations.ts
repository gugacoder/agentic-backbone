import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  sendMessage,
  createSession,
  getSession,
  listSessions,
  updateSession,
  deleteSession,
  readMessages,
  type UserContext,
} from "../conversations/index.js";
import { getAuthUser } from "./auth-helpers.js";
import { getAgent } from "../agents/registry.js";

const UPLOADS_DIR = resolve(process.cwd(), "data/uploads");
mkdirSync(UPLOADS_DIR, { recursive: true });

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
  const contentType = c.req.header("content-type") ?? "";

  let message: string;
  let tenant_id: number | null = null;
  let attachedFilesSection = "";

  if (contentType.includes("multipart/form-data")) {
    // Parse multipart form data
    const formData = await c.req.formData();
    message = (formData.get("message") as string) ?? "";
    const tenantRaw = formData.get("tenant_id");
    tenant_id = tenantRaw ? Number(tenantRaw) : null;

    // Save uploaded files and build <attached_files> section
    const sessionUploadsDir = join(UPLOADS_DIR, sessionId);
    mkdirSync(sessionUploadsDir, { recursive: true });

    const attachedFiles: Array<{ path: string; name: string; mime: string; size: number }> = [];
    for (const [, value] of formData.entries()) {
      if (value instanceof File) {
        const ts = Date.now();
        const safeFileName = value.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const destName = `${ts}-${safeFileName}`;
        const destPath = join(sessionUploadsDir, destName);
        const buffer = Buffer.from(await value.arrayBuffer());
        await writeFile(destPath, buffer);
        // Convert Windows backslash paths to POSIX for shell scripts (C:\foo\bar → /c/foo/bar)
        const shellPath = destPath
          .replace(/\\/g, "/")
          .replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`);
        attachedFiles.push({
          path: shellPath,
          name: value.name,
          mime: value.type || "application/octet-stream",
          size: value.size,
        });
      }
    }

    if (attachedFiles.length > 0) {
      const lines = attachedFiles.map(
        (f) => `  - ${f.path} (${f.name}, ${f.mime}, ${f.size} bytes)`
      );
      attachedFilesSection = `\n\n<attached_files>\n${lines.join("\n")}\n</attached_files>`;
    }
  } else {
    // JSON body (default)
    const body = await c.req.json<{ message: string; tenant_id?: number | null }>();
    message = body.message;
    tenant_id = body.tenant_id ?? null;
  }

  if (!message) {
    return c.json({ error: "message is required" }, 400);
  }

  // Append attached files info to message for the agent
  const fullMessage = message + attachedFilesSection;

  const userCtx: UserContext = {
    user_id: auth.user,
    role: auth.role,
    active_tenant_id: tenant_id ?? null,
    tenant_ids: auth.unidades ?? [],
  };

  return streamSSE(c, async (stream) => {
    try {
      for await (const event of sendMessage(auth.user, sessionId, fullMessage, userCtx)) {
        await stream.writeSSE({ data: JSON.stringify(event) });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[conversations] stream error (session=${sessionId}):`, msg);
      await stream.writeSSE({
        data: JSON.stringify({ type: "error", content: `Erro interno: ${msg}` }),
      });
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
