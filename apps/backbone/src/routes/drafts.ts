import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  cpSync,
} from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { agentDir } from "../context/paths.js";
import { getAgent } from "../agents/registry.js";
import { createVersion } from "../versions/version-manager.js";
import { refreshAgentRegistry } from "../agents/registry.js";
import { runAgent } from "../agent/index.js";
import { collectAgentResult } from "../utils/agent-stream.js";
import { formatError } from "../utils/errors.js";
import { parseBody } from "./helpers.js";

export const draftRoutes = new Hono();

// --- Helpers ---

interface DraftMeta {
  id: string;
  agentId: string;
  label: string;
  createdAt: string;
  updatedAt: string;
  status: "draft";
}

function draftsDir(agentId: string): string {
  return join(agentDir(agentId), "drafts");
}

function draftDir(agentId: string, draftId: string): string {
  return join(draftsDir(agentId), draftId);
}

function draftJsonPath(agentId: string, draftId: string): string {
  return join(draftDir(agentId, draftId), "draft.json");
}

function readDraftMeta(agentId: string, draftId: string): DraftMeta | null {
  const p = draftJsonPath(agentId, draftId);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf-8")) as DraftMeta;
}

function writeDraftMeta(meta: DraftMeta): void {
  writeFileSync(
    draftJsonPath(meta.agentId, meta.id),
    JSON.stringify(meta, null, 2)
  );
}

function listMdFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(
    (f) => f.endsWith(".md") && !f.startsWith(".")
  );
}

/** Build a minimal system prompt from draft files */
function assembleDraftPrompt(agentId: string, draftId: string): string {
  const dir = draftDir(agentId, draftId);
  const parts: string[] = [];

  const soul = join(dir, "SOUL.md");
  if (existsSync(soul)) {
    parts.push(`<identity>\n${readFileSync(soul, "utf-8")}\n</identity>`);
  }

  const conv = join(dir, "CONVERSATION.md");
  if (existsSync(conv)) {
    parts.push(`<instructions>\n${readFileSync(conv, "utf-8")}\n</instructions>`);
  }

  parts.push(`<agent_context>\nagent_id: ${agentId}\nmode: draft (sandbox)\n</agent_context>`);
  return parts.join("\n\n");
}

// --- GET /agents/:agentId/drafts ---

draftRoutes.get("/agents/:agentId/drafts", (c) => {
  const agentId = c.req.param("agentId");
  if (!getAgent(agentId)) return c.json({ error: "not found" }, 404);

  const dir = draftsDir(agentId);
  if (!existsSync(dir)) return c.json([]);

  const drafts: DraftMeta[] = [];
  for (const draftId of readdirSync(dir)) {
    const meta = readDraftMeta(agentId, draftId);
    if (meta) drafts.push(meta);
  }
  return c.json(drafts);
});

// --- POST /agents/:agentId/drafts ---

draftRoutes.post("/agents/:agentId/drafts", async (c) => {
  const agentId = c.req.param("agentId");
  if (!getAgent(agentId)) return c.json({ error: "not found" }, 404);

  const body = await parseBody<{ label?: string }>(c);
  if (body instanceof Response) return body;
  const draftId = `draft_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const dir = draftDir(agentId, draftId);

  mkdirSync(dir, { recursive: true });

  // Copy all .md files from agent root
  const srcDir = agentDir(agentId);
  for (const file of listMdFiles(srcDir)) {
    cpSync(join(srcDir, file), join(dir, file));
  }

  const meta: DraftMeta = {
    id: draftId,
    agentId,
    label: body.label ?? "Rascunho sem título",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "draft",
  };
  writeDraftMeta(meta);

  return c.json(meta, 201);
});

// --- GET /agents/:agentId/drafts/:draftId ---

draftRoutes.get("/agents/:agentId/drafts/:draftId", (c) => {
  const agentId = c.req.param("agentId");
  const draftId = c.req.param("draftId");

  const meta = readDraftMeta(agentId, draftId);
  if (!meta) return c.json({ error: "not found" }, 404);

  const dir = draftDir(agentId, draftId);
  const files: Record<string, string> = {};
  for (const file of listMdFiles(dir)) {
    files[file] = readFileSync(join(dir, file), "utf-8");
  }

  return c.json({ ...meta, files });
});

// --- PATCH /agents/:agentId/drafts/:draftId ---

draftRoutes.patch("/agents/:agentId/drafts/:draftId", async (c) => {
  const agentId = c.req.param("agentId");
  const draftId = c.req.param("draftId");

  const meta = readDraftMeta(agentId, draftId);
  if (!meta) return c.json({ error: "not found" }, 404);

  const body = await parseBody<{ fileName?: string; content?: string; label?: string }>(c);
  if (body instanceof Response) return body;

  if (body.label) {
    meta.label = body.label;
  }

  if (body.fileName && body.content !== undefined) {
    const dir = draftDir(agentId, draftId);
    writeFileSync(join(dir, body.fileName), body.content, "utf-8");
  }

  meta.updatedAt = new Date().toISOString();
  writeDraftMeta(meta);
  return c.json(meta);
});

// --- DELETE /agents/:agentId/drafts/:draftId ---

draftRoutes.delete("/agents/:agentId/drafts/:draftId", (c) => {
  const agentId = c.req.param("agentId");
  const draftId = c.req.param("draftId");

  const meta = readDraftMeta(agentId, draftId);
  if (!meta) return c.json({ error: "not found" }, 404);

  const dir = draftDir(agentId, draftId);
  rmSync(dir, { recursive: true, force: true });
  return c.json({ deleted: true });
});

// --- POST /agents/:agentId/drafts/:draftId/publish ---

draftRoutes.post("/agents/:agentId/drafts/:draftId/publish", async (c) => {
  const agentId = c.req.param("agentId");
  const draftId = c.req.param("draftId");

  const meta = readDraftMeta(agentId, draftId);
  if (!meta) return c.json({ error: "not found" }, 404);

  const srcDir = draftDir(agentId, draftId);
  const destDir = agentDir(agentId);

  // 1. Create versions for all .md files being overwritten
  let lastVersionId = 0;
  for (const file of listMdFiles(srcDir)) {
    const destFile = join(destDir, file);
    if (existsSync(destFile)) {
      const currentContent = readFileSync(destFile, "utf-8");
      const versionNum = createVersion(agentId, file, currentContent, {
        changeNote: `Published from draft ${draftId} (${meta.label})`,
      });
      lastVersionId = versionNum;
    }
  }

  // 2. Copy draft files to production
  for (const file of listMdFiles(srcDir)) {
    cpSync(join(srcDir, file), join(destDir, file));
  }

  // 3. Remove draft directory
  rmSync(srcDir, { recursive: true, force: true });

  // 4. Hot reload
  try {
    refreshAgentRegistry();
  } catch {
    // non-fatal
  }

  const publishedAt = new Date().toISOString();
  return c.json({ publishedAt, versionId: lastVersionId });
});

// --- POST /agents/:agentId/drafts/:draftId/chat (SSE) ---

draftRoutes.post("/agents/:agentId/drafts/:draftId/chat", async (c) => {
  const agentId = c.req.param("agentId");
  const draftId = c.req.param("draftId");

  const meta = readDraftMeta(agentId, draftId);
  if (!meta) return c.json({ error: "not found" }, 404);

  const body = await parseBody<{ message?: string }>(c);
  if (body instanceof Response) return body;
  const message = body.message ?? "";
  const system = assembleDraftPrompt(agentId, draftId);

  return streamSSE(c, async (stream) => {
    for await (const event of runAgent(message, { role: "conversation", system, cwd: agentDir(agentId) })) {
      await stream.writeSSE({
        data: JSON.stringify(event),
        event: event.type,
      });
    }
  });
});

// --- POST /agents/:agentId/drafts/:draftId/compare ---

draftRoutes.post("/agents/:agentId/drafts/:draftId/compare", async (c) => {
  const agentId = c.req.param("agentId");
  const draftId = c.req.param("draftId");

  const meta = readDraftMeta(agentId, draftId);
  if (!meta) return c.json({ error: "not found" }, 404);

  if (!getAgent(agentId)) return c.json({ error: "agent not found" }, 404);

  const body = await parseBody<{ message?: string }>(c);
  if (body instanceof Response) return body;
  const message = body.message ?? "";

  const draftSystem = assembleDraftPrompt(agentId, draftId);

  // Build production system prompt (minimal)
  const prodDir = agentDir(agentId);
  const prodParts: string[] = [];
  const prodSoul = join(prodDir, "SOUL.md");
  if (existsSync(prodSoul)) {
    prodParts.push(`<identity>\n${readFileSync(prodSoul, "utf-8")}\n</identity>`);
  }
  const prodConv = join(prodDir, "CONVERSATION.md");
  if (existsSync(prodConv)) {
    prodParts.push(`<instructions>\n${readFileSync(prodConv, "utf-8")}\n</instructions>`);
  }
  prodParts.push(`<agent_context>\nagent_id: ${agentId}\n</agent_context>`);
  const prodSystem = prodParts.join("\n\n");

  try {
    const [prod, draft] = await Promise.all([
      collectAgentResult(runAgent(message, { role: "conversation", system: prodSystem, cwd: agentDir(agentId) })),
      collectAgentResult(runAgent(message, { role: "conversation", system: draftSystem, cwd: agentDir(agentId) })),
    ]);

    return c.json({
      production: { text: prod.fullText, usage: prod.usage },
      draft: { text: draft.fullText, usage: draft.usage, label: meta.label },
    });
  } catch (err) {
    return c.json({ error: formatError(err) }, 500);
  }
});
