import { Hono } from "hono";
import { loadWhisperConfig } from "../settings/whisper.js";

export const transcriptionRoutes = new Hono();

// --- POST /transcriptions ---
// Accepts multipart/form-data: file (audio), language (optional, default "pt")
// Proxies to Whisper HTTP service and returns transcription text

transcriptionRoutes.post("/transcriptions", async (c) => {
  const host = process.env.WHISPER_HOST;
  const port = process.env.WHISPER_PORT;

  if (!host || !port) {
    return c.json({ error: "Whisper não configurado (WHISPER_HOST / WHISPER_PORT ausentes)" }, 503);
  }

  const whisperUrl = `http://${host}:${port}`;

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: "Body deve ser multipart/form-data" }, 400);
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return c.json({ error: "Campo 'file' obrigatório (audio)" }, 400);
  }

  const language = (formData.get("language") as string | null) ?? "pt";
  const config = loadWhisperConfig();

  const outForm = new FormData();
  outForm.append("file", file);
  outForm.append("model", config.model);
  outForm.append("language", language);
  outForm.append("response_format", "verbose_json");

  let res: Response;
  try {
    res = await fetch(`${whisperUrl}/v1/audio/transcriptions`, {
      method: "POST",
      body: outForm,
      signal: AbortSignal.timeout(120_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Whisper indisponível: ${msg}` }, 503);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return c.json({ error: `Whisper error ${res.status}: ${errText}` }, 502);
  }

  const result = await res.json() as { text?: string; segments?: unknown[]; duration?: number };
  return c.json({
    text: result.text ?? "",
    duration: result.duration ?? null,
    segments: result.segments ?? [],
    model: config.model,
    language,
  });
});

// --- GET /transcriptions/health ---
// Checks if whisper service is reachable

transcriptionRoutes.get("/transcriptions/health", async (c) => {
  const host = process.env.WHISPER_HOST;
  const port = process.env.WHISPER_PORT;

  if (!host || !port) {
    return c.json({ available: false, reason: "WHISPER_HOST / WHISPER_PORT não configurados" });
  }

  const config = loadWhisperConfig();
  const whisperUrl = `http://${host}:${port}`;

  try {
    const res = await fetch(`${whisperUrl}/health`, {
      signal: AbortSignal.timeout(3_000),
    });
    return c.json({ available: res.ok, model: config.model, url: whisperUrl });
  } catch {
    return c.json({ available: false, model: config.model, url: whisperUrl });
  }
});
