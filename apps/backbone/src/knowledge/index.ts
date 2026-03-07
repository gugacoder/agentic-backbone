import { db } from "../db/index.js";
import { agentDir } from "../context/paths.js";
import { getAgentMemoryManager } from "../memory/manager.js";
import { join } from "node:path";
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from "node:fs";

// --- Types ---

export interface KnowledgeDoc {
  id: number;
  agent_id: string;
  filename: string;
  slug: string;
  content_type: string;
  size_bytes: number;
  chunks: number;
  status: string;
  error: string | null;
  created_at: string;
}

// --- Limits ---

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_DOCS_PER_AGENT = 50;

// --- Prepared statements ---

const insertDoc = db.prepare(`
  INSERT INTO knowledge_docs (agent_id, filename, slug, content_type, size_bytes, status)
  VALUES (@agentId, @filename, @slug, @contentType, @sizeBytes, 'processing')
`);

const updateDocStatus = db.prepare(`
  UPDATE knowledge_docs SET status = @status, chunks = @chunks, error = @error WHERE id = @id
`);

const deleteDocStmt = db.prepare(`DELETE FROM knowledge_docs WHERE id = @id`);

const getDocById = db.prepare(`SELECT * FROM knowledge_docs WHERE id = ? AND agent_id = ?`);

const listDocs = db.prepare(`SELECT * FROM knowledge_docs WHERE agent_id = ? ORDER BY created_at DESC`);

const countDocs = db.prepare(`SELECT COUNT(*) as count FROM knowledge_docs WHERE agent_id = ?`);

// --- Helpers ---

function slugify(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "");
  return "doc-" + base
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function knowledgeDir(agentId: string): string {
  return join(agentDir(agentId), "knowledge");
}

function ensureKnowledgeDir(agentId: string): string {
  const dir = knowledgeDir(agentId);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function contentTypeFromExt(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "pdf") return "application/pdf";
  if (ext === "txt") return "text/plain";
  if (ext === "md") return "text/markdown";
  return "application/octet-stream";
}

// --- PDF conversion ---

async function convertPdfToMarkdown(buffer: Buffer): Promise<string> {
  // Dynamic import — pdf-parse is optional and only loaded when needed
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return data.text;
}

function convertToMarkdown(buffer: Buffer, contentType: string): Promise<string> {
  if (contentType === "application/pdf") {
    return convertPdfToMarkdown(buffer);
  }
  // TXT and MD are used directly
  return Promise.resolve(buffer.toString("utf-8"));
}

// --- Pipeline ---

export async function uploadKnowledgeDoc(
  agentId: string,
  filename: string,
  buffer: Buffer
): Promise<KnowledgeDoc> {
  // Validate size
  if (buffer.byteLength > MAX_FILE_SIZE) {
    throw new KnowledgeError(`Arquivo excede o limite de 10MB (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB)`, 413);
  }

  // Validate doc count
  const { count } = countDocs.get(agentId) as { count: number };
  if (count >= MAX_DOCS_PER_AGENT) {
    throw new KnowledgeError(`Limite de ${MAX_DOCS_PER_AGENT} documentos por agente atingido`, 422);
  }

  const contentType = contentTypeFromExt(filename);

  // Validate file type
  if (!["application/pdf", "text/plain", "text/markdown"].includes(contentType)) {
    throw new KnowledgeError("Tipo de arquivo nao suportado. Use PDF, TXT ou MD.", 422);
  }

  const slug = slugify(filename);

  // Convert to markdown
  let markdown: string;
  try {
    markdown = await convertToMarkdown(buffer, contentType);
  } catch (err) {
    throw new KnowledgeError(`Falha ao converter arquivo: ${(err as Error).message}`, 500);
  }

  // Save markdown file to knowledge/ dir
  const dir = ensureKnowledgeDir(agentId);
  const mdPath = join(dir, `${slug}.md`);
  writeFileSync(mdPath, markdown, "utf-8");

  // Insert record
  const result = insertDoc.run({
    agentId,
    filename,
    slug,
    contentType: contentType,
    sizeBytes: buffer.byteLength,
  });
  const docId = result.lastInsertRowid as number;

  // Trigger reindex in background (non-blocking)
  reindexAndUpdateDoc(agentId, docId).catch(() => {
    // Error already handled inside
  });

  return getDocById.get(docId, agentId) as KnowledgeDoc;
}

async function reindexAndUpdateDoc(agentId: string, docId: number): Promise<void> {
  try {
    const mgr = getAgentMemoryManager(agentId);
    await mgr.sync({ force: true });
    const { chunkCount } = mgr.status();
    updateDocStatus.run({ id: docId, status: "indexed", chunks: chunkCount, error: null });
  } catch (err) {
    updateDocStatus.run({ id: docId, status: "error", chunks: 0, error: (err as Error).message });
  }
}

export async function deleteKnowledgeDoc(agentId: string, docId: number): Promise<void> {
  const doc = getDocById.get(docId, agentId) as KnowledgeDoc | undefined;
  if (!doc) {
    throw new KnowledgeError("Documento nao encontrado", 404);
  }

  // Remove file
  const mdPath = join(knowledgeDir(agentId), `${doc.slug}.md`);
  if (existsSync(mdPath)) {
    unlinkSync(mdPath);
  }

  // Remove record
  deleteDocStmt.run({ id: docId });

  // Reindex to remove stale embeddings
  try {
    const mgr = getAgentMemoryManager(agentId);
    await mgr.sync({ force: true });
  } catch {
    // Best-effort reindex
  }
}

export function getKnowledgeDoc(agentId: string, docId: number): KnowledgeDoc | undefined {
  return getDocById.get(docId, agentId) as KnowledgeDoc | undefined;
}

export function listKnowledgeDocs(agentId: string): KnowledgeDoc[] {
  return listDocs.all(agentId) as KnowledgeDoc[];
}

export function getKnowledgeDocCount(agentId: string): number {
  return (countDocs.get(agentId) as { count: number }).count;
}

// --- Error class ---

export class KnowledgeError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "KnowledgeError";
  }
}
