import { Hono } from "hono";
import {
  listKnowledgeDocs,
  getKnowledgeDoc,
  uploadKnowledgeDoc,
  deleteKnowledgeDoc,
  KnowledgeError,
} from "../knowledge/index.js";

export const knowledgeRoutes = new Hono();

// ── GET /agents/:id/knowledge ────────────────────────────

knowledgeRoutes.get("/agents/:id/knowledge", (c) => {
  const agentId = c.req.param("id");
  const docs = listKnowledgeDocs(agentId);
  return c.json({
    docs: docs.map(formatDoc),
  });
});

// ── POST /agents/:id/knowledge ───────────────────────────

knowledgeRoutes.post("/agents/:id/knowledge", async (c) => {
  const agentId = c.req.param("id");

  const body = await c.req.parseBody();
  const file = body["file"];

  if (!file || !(file instanceof File)) {
    return c.json({ error: "campo 'file' obrigatorio (multipart)" }, 400);
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const doc = await uploadKnowledgeDoc(agentId, file.name, buffer);
    return c.json(formatDoc(doc), 201);
  } catch (err) {
    if (err instanceof KnowledgeError) {
      return c.json({ error: err.message }, err.statusCode as 400);
    }
    throw err;
  }
});

// ── GET /agents/:id/knowledge/:docId ─────────────────────

knowledgeRoutes.get("/agents/:id/knowledge/:docId", (c) => {
  const agentId = c.req.param("id");
  const docId = Number(c.req.param("docId"));

  if (Number.isNaN(docId)) {
    return c.json({ error: "docId invalido" }, 400);
  }

  const doc = getKnowledgeDoc(agentId, docId);
  if (!doc) {
    return c.json({ error: "documento nao encontrado" }, 404);
  }

  return c.json(formatDoc(doc));
});

// ── DELETE /agents/:id/knowledge/:docId ──────────────────

knowledgeRoutes.delete("/agents/:id/knowledge/:docId", async (c) => {
  const agentId = c.req.param("id");
  const docId = Number(c.req.param("docId"));

  if (Number.isNaN(docId)) {
    return c.json({ error: "docId invalido" }, 400);
  }

  try {
    await deleteKnowledgeDoc(agentId, docId);
    return c.json({ status: "deleted" });
  } catch (err) {
    if (err instanceof KnowledgeError) {
      return c.json({ error: err.message }, err.statusCode as 400);
    }
    throw err;
  }
});

// ── Helpers ──────────────────────────────────────────────

function formatDoc(doc: {
  id: number;
  filename: string;
  slug: string;
  content_type: string;
  size_bytes: number;
  chunks: number;
  status: string;
  error: string | null;
  created_at: string;
}) {
  return {
    id: doc.id,
    filename: doc.filename,
    slug: doc.slug,
    contentType: doc.content_type,
    sizeBytes: doc.size_bytes,
    chunks: doc.chunks,
    status: doc.status,
    error: doc.error,
    createdAt: doc.created_at,
  };
}
