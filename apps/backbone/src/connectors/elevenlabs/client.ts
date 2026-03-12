import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface ElevenLabsCredential {
  api_key: string;
}

export interface ElevenLabsOptions {
  voice_id: string;
  model_id: string;
  output_format: string;
}

export interface ElevenLabsClient {
  speak(text: string, voice_id?: string): Promise<{ file_path: string; size_bytes: number }>;
  listVoices(): Promise<Array<{ voice_id: string; name: string; category: string }>>;
  ping(): Promise<{ ok: boolean; latencyMs: number; subscription?: string; error?: string }>;
}

export function createElevenLabsClient(
  credential: ElevenLabsCredential,
  options: ElevenLabsOptions,
): ElevenLabsClient {
  const { api_key } = credential;
  const headers = { "xi-api-key": api_key, "Content-Type": "application/json" };

  async function speak(text: string, voice_id?: string): Promise<{ file_path: string; size_bytes: number }> {
    const vid = voice_id ?? options.voice_id;
    const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vid}`, {
      method: "POST",
      headers: { ...headers, Accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: options.model_id,
        output_format: options.output_format,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`ElevenLabs TTS error ${resp.status}: ${err}`);
    }

    const buffer = await resp.arrayBuffer();
    const bytes = Buffer.from(buffer);
    const tmpDir = join(process.cwd(), ".tmp");
    mkdirSync(tmpDir, { recursive: true });
    const file_path = join(tmpDir, `elevenlabs-${Date.now()}.mp3`);
    writeFileSync(file_path, bytes);

    return { file_path, size_bytes: bytes.length };
  }

  async function listVoices(): Promise<Array<{ voice_id: string; name: string; category: string }>> {
    const resp = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers,
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) {
      throw new Error(`ElevenLabs voices error ${resp.status}`);
    }
    const data = (await resp.json()) as { voices: Array<{ voice_id: string; name: string; category: string }> };
    return data.voices.map((v) => ({ voice_id: v.voice_id, name: v.name, category: v.category }));
  }

  async function ping(): Promise<{ ok: boolean; latencyMs: number; subscription?: string; error?: string }> {
    const start = Date.now();
    try {
      const resp = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers,
        signal: AbortSignal.timeout(8000),
      });
      const latencyMs = Date.now() - start;
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({})) as Record<string, unknown>;
        const rawDetail = body.detail as Record<string, string> | string | undefined;
        const status = typeof rawDetail === "object" ? rawDetail?.status : undefined;
        // missing_permissions means the key is valid but has restricted scope — treat as ok
        if (status === "missing_permissions") {
          return { ok: true, latencyMs };
        }
        const detail = typeof rawDetail === "string" ? rawDetail
          : rawDetail != null ? JSON.stringify(rawDetail)
          : `HTTP ${resp.status}`;
        return { ok: false, latencyMs, error: detail };
      }
      await resp.json();
      return { ok: true, latencyMs };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
    }
  }

  return { speak, listVoices, ping };
}
