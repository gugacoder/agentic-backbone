import { db } from "../db/index.js";
import { eventBus } from "../events/index.js";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { mkdirSync, createReadStream, unlinkSync, statSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import type { ReadStream } from "node:fs";

// --- Constants ---

const STORAGE_DIR = join(process.cwd(), "data", "transcriptions");
mkdirSync(STORAGE_DIR, { recursive: true });

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

// --- Types ---

export interface TranscriptionRow {
  id: string;
  user_id: string;
  filename: string;
  original_name: string;
  file_size: number;
  mime_type: string | null;
  language: string;
  status: "queued" | "processing" | "completed" | "failed";
  result_text: string | null;
  result_segments: string | null;
  duration: number | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface TranscriptionSummary {
  id: string;
  original_name: string;
  file_size: number;
  language: string;
  status: "queued" | "processing" | "completed" | "failed";
  duration: number | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

// --- Prepared Statements ---

const insertStmt = db.prepare(`
  INSERT INTO transcriptions (id, user_id, filename, original_name, file_size, mime_type, language, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, 'queued')
`);

const updateStatusStmt = db.prepare(`
  UPDATE transcriptions SET status = ?, error = ?, completed_at = CASE WHEN ? IN ('completed', 'failed') THEN datetime('now') ELSE NULL END
  WHERE id = ?
`);

const updateResultStmt = db.prepare(`
  UPDATE transcriptions SET status = 'completed', result_text = ?, result_segments = ?, duration = ?, completed_at = datetime('now')
  WHERE id = ?
`);

const updateFailedStmt = db.prepare(`
  UPDATE transcriptions SET status = 'failed', error = ?, completed_at = datetime('now')
  WHERE id = ?
`);

const listStmt = db.prepare(`
  SELECT id, original_name, file_size, language, status, duration, error, created_at, completed_at
  FROM transcriptions
  WHERE user_id = ?
  ORDER BY created_at DESC
  LIMIT ? OFFSET ?
`);

const listAllStmt = db.prepare(`
  SELECT id, original_name, file_size, language, status, duration, error, created_at, completed_at
  FROM transcriptions
  ORDER BY created_at DESC
  LIMIT ? OFFSET ?
`);

const countStmt = db.prepare(`SELECT COUNT(*) as total FROM transcriptions WHERE user_id = ?`);
const countAllStmt = db.prepare(`SELECT COUNT(*) as total FROM transcriptions`);

const getStmt = db.prepare(`SELECT * FROM transcriptions WHERE id = ?`);

const deleteStmt = db.prepare(`DELETE FROM transcriptions WHERE id = ?`);

// --- Startup Recovery ---

db.prepare(`
  UPDATE transcriptions SET status = 'failed', error = 'Server reiniciou durante processamento'
  WHERE status = 'processing'
`).run();

// --- Service Functions ---

export function createTranscription(
  userId: string,
  fileBuffer: Buffer,
  originalName: string,
  fileSize: number,
  mimeType: string | null,
  language: string
): TranscriptionRow {
  if (fileSize > MAX_FILE_SIZE) {
    throw Object.assign(new Error("Arquivo excede o limite de 100 MB"), { statusCode: 413 });
  }

  const id = randomUUID();
  const ext = originalName.split(".").pop()?.toLowerCase() ?? "bin";
  const filename = `${id}.${ext}`;
  const filepath = join(STORAGE_DIR, filename);

  // Save file synchronously to disk (we already have the buffer)
  // Use writeFile async but we need the row first
  insertStmt.run(id, userId, filename, originalName, fileSize, mimeType, language);

  const row = getStmt.get(id) as TranscriptionRow;

  // Emit SSE
  eventBus.emit("transcription:status", {
    ts: Date.now(),
    id,
    userId,
    status: "queued",
    originalName,
  });

  // Save file and process async (fire-and-forget)
  writeFile(filepath, fileBuffer)
    .then(() => processTranscription(id))
    .catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      updateFailedStmt.run(`Erro ao salvar arquivo: ${msg}`, id);
      eventBus.emit("transcription:status", {
        ts: Date.now(),
        id,
        userId,
        status: "failed",
        originalName,
        error: msg,
      });
    });

  return row;
}

async function processTranscription(id: string): Promise<void> {
  const row = getStmt.get(id) as TranscriptionRow | undefined;
  if (!row) return;

  // Update to processing
  updateStatusStmt.run("processing", null, "processing", id);
  eventBus.emit("transcription:status", {
    ts: Date.now(),
    id,
    userId: row.user_id,
    status: "processing",
    originalName: row.original_name,
  });

  const whisperUrl = process.env.WHISPER_URL;
  if (!whisperUrl) {
    updateFailedStmt.run("WHISPER_URL nao configurado", id);
    eventBus.emit("transcription:status", {
      ts: Date.now(),
      id,
      userId: row.user_id,
      status: "failed",
      originalName: row.original_name,
      error: "WHISPER_URL nao configurado",
    });
    return;
  }

  const filepath = join(STORAGE_DIR, row.filename);

  try {
    const fileBuffer = await import("node:fs/promises").then((fs) => fs.readFile(filepath));
    const model = process.env.WHISPER_MODEL ?? "small";

    const formData = new FormData();
    formData.append(
      "file",
      new Blob([fileBuffer], { type: row.mime_type ?? "audio/mpeg" }),
      row.original_name
    );
    formData.append("model", model);
    formData.append("language", row.language);
    formData.append("response_format", "verbose_json");

    const res = await fetch(`${whisperUrl}/v1/audio/transcriptions`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "unknown error");
      const errorMsg = `Whisper error: ${res.status} ${errText}`;
      updateFailedStmt.run(errorMsg, id);
      eventBus.emit("transcription:status", {
        ts: Date.now(),
        id,
        userId: row.user_id,
        status: "failed",
        originalName: row.original_name,
        error: errorMsg,
      });
      return;
    }

    const result = await res.json() as { text?: string; segments?: unknown[]; duration?: number };

    updateResultStmt.run(
      result.text ?? "",
      result.segments ? JSON.stringify(result.segments) : null,
      result.duration ?? null,
      id
    );

    eventBus.emit("transcription:status", {
      ts: Date.now(),
      id,
      userId: row.user_id,
      status: "completed",
      originalName: row.original_name,
      duration: result.duration,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const errorMsg = msg.includes("fetch") || msg.includes("ECONNREFUSED")
      ? "Whisper service unavailable"
      : msg;
    updateFailedStmt.run(errorMsg, id);
    eventBus.emit("transcription:status", {
      ts: Date.now(),
      id,
      userId: row.user_id,
      status: "failed",
      originalName: row.original_name,
      error: errorMsg,
    });
  }
}

export function listTranscriptions(
  userId: string | null,
  limit: number,
  offset: number
): { items: TranscriptionSummary[]; total: number } {
  if (userId) {
    const items = listStmt.all(userId, limit, offset) as TranscriptionSummary[];
    const { total } = countStmt.get(userId) as { total: number };
    return { items, total };
  }
  // sysuser — list all
  const items = listAllStmt.all(limit, offset) as TranscriptionSummary[];
  const { total } = countAllStmt.get() as { total: number };
  return { items, total };
}

export function getTranscription(id: string): TranscriptionRow | undefined {
  return getStmt.get(id) as TranscriptionRow | undefined;
}

export function deleteTranscription(id: string): boolean {
  const row = getStmt.get(id) as TranscriptionRow | undefined;
  if (!row) return false;

  // Delete DB row
  deleteStmt.run(id);

  // Delete file from disk
  try {
    const filepath = join(STORAGE_DIR, row.filename);
    unlinkSync(filepath);
  } catch {
    // File may already be gone — that's OK
  }

  return true;
}

export function getTranscriptionFilePath(id: string): {
  stream: ReadStream;
  mimeType: string;
  originalName: string;
  fileSize: number;
} | null {
  const row = getStmt.get(id) as TranscriptionRow | undefined;
  if (!row) return null;

  const filepath = join(STORAGE_DIR, row.filename);
  try {
    const stats = statSync(filepath);
    return {
      stream: createReadStream(filepath),
      mimeType: row.mime_type ?? "application/octet-stream",
      originalName: row.original_name,
      fileSize: stats.size,
    };
  } catch {
    return null;
  }
}
