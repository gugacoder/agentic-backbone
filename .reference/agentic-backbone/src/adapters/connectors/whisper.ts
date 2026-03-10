import { readFileSync, existsSync } from "node:fs";
import { basename } from "node:path";
import type { WhisperParams, WhisperConnector, TranscribeOptions } from "./types.js";

export function createWhisperConnector(params: WhisperParams): WhisperConnector {
  const baseUrl = `http://${params.host}:${params.port}`;

  async function transcribe(options: TranscribeOptions): Promise<{ text: string }> {
    if (!options.audioUrl && !options.audioBase64) {
      throw new Error("Either audioUrl or audioBase64 must be provided");
    }

    const form = new FormData();

    if (options.audioUrl) {
      const url = options.audioUrl;
      const isLocalPath = url.startsWith("/") || url.startsWith("file://") ||
        /^[A-Za-z]:[/\\]/.test(url);

      if (isLocalPath) {
        // Read from local filesystem
        let filePath = url.startsWith("file://")
          ? url.replace(/^file:\/\//, "")
          : url;
        // Convert POSIX-style Windows drive paths (/d/foo → D:/foo) for Node.js on Windows
        if (/^\/[a-z]\//i.test(filePath)) {
          filePath = filePath.replace(/^\/([a-z])\//, (_, d) => `${d.toUpperCase()}:/`);
        }
        if (!existsSync(filePath)) {
          throw new Error(`Audio file not found: ${filePath}`);
        }
        const buffer = readFileSync(filePath);
        const filename = options.filename ?? basename(filePath);
        form.append("file", new File([buffer], filename));
      } else {
        // Fetch from HTTP URL
        const response = await fetch(url, {
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch audio from ${url}: ${response.status}`);
        }
        const blob = await response.blob();
        const filename = options.filename ?? "audio.ogg";
        form.append("file", new File([blob], filename));
      }
    } else if (options.audioBase64) {
      const buffer = Buffer.from(options.audioBase64, "base64");
      const filename = options.filename ?? "audio.ogg";
      const blob = new Blob([buffer]);
      form.append("file", new File([blob], filename));
    }

    form.append("model", process.env.WHISPER_MODEL ?? "small");
    if (options.language) {
      form.append("language", options.language);
    }

    // Timeout: proportional to file size — minimum 120s, +60s per 100MB
    const timeoutMs = 120_000;
    const response = await fetch(`${baseUrl}/v1/audio/transcriptions`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Whisper transcription failed (${response.status}): ${text}`);
    }

    const result = (await response.json()) as { text: string };
    return { text: result.text };
  }

  async function health(): Promise<string> {
    const response = await fetch(baseUrl, {
      signal: AbortSignal.timeout(5_000),
    });
    return response.ok ? "Whisper connection OK" : `Whisper: HTTP ${response.status}`;
  }

  async function close(): Promise<void> {
    // HTTP stateless — no-op
  }

  return { transcribe, health, close };
}
