import { Hono } from "hono";
import { stream } from "hono/streaming";
import {
  createTranscription,
  listTranscriptions,
  getTranscription,
  deleteTranscription,
  getTranscriptionFilePath,
} from "../transcriptions/service.js";

export const transcribeRoutes = new Hono();

const ALLOWED_EXTENSIONS = new Set([
  "mp3", "mp4", "m4a", "wav", "webm", "ogg", "flac", "mpeg", "mpga",
]);

// --- POST /transcribe — Upload + create async job ---

transcribeRoutes.post("/transcribe", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return c.json({ error: "file is required (multipart field 'file')" }, 400);
  }

  // Validate extension
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return c.json({
      error: `Unsupported file format: .${ext}. Accepted: ${[...ALLOWED_EXTENSIONS].join(", ")}`,
    }, 400);
  }

  const language = (formData.get("language") as string) ?? "pt";
  const jwt = c.get("jwtPayload") as { sub?: string; id?: number };
  const userId = String(jwt.sub ?? jwt.id ?? "unknown");

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const row = createTranscription(
      userId,
      buffer,
      file.name,
      file.size,
      file.type || null,
      language
    );

    return c.json(
      {
        id: row.id,
        status: row.status,
        original_name: row.original_name,
        file_size: row.file_size,
        language: row.language,
        created_at: row.created_at,
      },
      202
    );
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 413) {
      return c.json({ error: (err as Error).message }, 413);
    }
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 500);
  }
});

// --- GET /transcriptions — List (paginated) ---

transcribeRoutes.get("/transcriptions", (c) => {
  const jwt = c.get("jwtPayload") as { sub?: string; id?: number; role?: string };
  const userId = String(jwt.sub ?? jwt.id ?? "unknown");
  const isSysuser = jwt.role === "sysuser";

  const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10) || 50, 200);
  const offset = parseInt(c.req.query("offset") ?? "0", 10) || 0;

  const result = listTranscriptions(isSysuser ? null : userId, limit, offset);

  return c.json({
    items: result.items,
    total: result.total,
    limit,
    offset,
  });
});

// --- GET /transcriptions/:id — Detail ---

transcribeRoutes.get("/transcriptions/:id", (c) => {
  const jwt = c.get("jwtPayload") as { sub?: string; id?: number; role?: string };
  const userId = String(jwt.sub ?? jwt.id ?? "unknown");
  const isSysuser = jwt.role === "sysuser";

  const row = getTranscription(c.req.param("id"));
  if (!row) return c.json({ error: "not found" }, 404);
  if (!isSysuser && row.user_id !== userId) return c.json({ error: "not found" }, 404);

  return c.json({
    id: row.id,
    original_name: row.original_name,
    file_size: row.file_size,
    language: row.language,
    status: row.status,
    duration: row.duration,
    error: row.error,
    created_at: row.created_at,
    completed_at: row.completed_at,
    result_text: row.result_text,
    result_segments: row.result_segments ? JSON.parse(row.result_segments) : null,
  });
});

// --- GET /transcriptions/:id/audio — Download audio file ---

transcribeRoutes.get("/transcriptions/:id/audio", (c) => {
  const jwt = c.get("jwtPayload") as { sub?: string; id?: number; role?: string };
  const userId = String(jwt.sub ?? jwt.id ?? "unknown");
  const isSysuser = jwt.role === "sysuser";

  const row = getTranscription(c.req.param("id"));
  if (!row) return c.json({ error: "not found" }, 404);
  if (!isSysuser && row.user_id !== userId) return c.json({ error: "not found" }, 404);

  const fileInfo = getTranscriptionFilePath(c.req.param("id"));
  if (!fileInfo) return c.json({ error: "file not found" }, 404);

  c.header("Content-Type", fileInfo.mimeType);
  c.header(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(fileInfo.originalName)}"`
  );
  c.header("Content-Length", String(fileInfo.fileSize));

  return stream(c, async (s) => {
    const nodeStream = fileInfo.stream;
    for await (const chunk of nodeStream) {
      await s.write(chunk as Uint8Array);
    }
  });
});

// --- DELETE /transcriptions/:id ---

transcribeRoutes.delete("/transcriptions/:id", (c) => {
  const jwt = c.get("jwtPayload") as { sub?: string; id?: number; role?: string };
  const userId = String(jwt.sub ?? jwt.id ?? "unknown");
  const isSysuser = jwt.role === "sysuser";

  const row = getTranscription(c.req.param("id"));
  if (!row) return c.json({ error: "not found" }, 404);
  if (!isSysuser && row.user_id !== userId) return c.json({ error: "forbidden" }, 403);

  deleteTranscription(c.req.param("id"));
  return c.body(null, 204);
});
