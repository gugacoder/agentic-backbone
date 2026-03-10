import { z } from "zod";
import type { ToolDefinition } from "../../agent/tool-defs.js";
import { loadAdapter } from "../loader.js";
import { normalizeSlug } from "../_utils.js";

export const connector = "whisper";

export function create(adapters: { slug: string; policy: string }[]): ToolDefinition {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  return {
    name: "whisper_transcribe",
    description: "Transcribe audio to text using Whisper. Provide either audio_url or audio_base64.",
    parameters: z.object({
      adapter: z.preprocess(normalizeSlug, z.enum(slugs)).describe(`Whisper adapter slug. Valid values: ${slugs.join(", ")}`),
      audio_url: z.string().optional().describe("URL of audio file to transcribe"),
      audio_base64: z.string().optional().describe("Base64-encoded audio data"),
      filename: z.string().optional().describe("Original filename (for format detection)"),
      language: z.string().optional().describe("Language code (e.g. pt, en)"),
    }),
    execute: async (args) => {
      if (!args.audio_url && !args.audio_base64) {
        return { error: "Either audio_url or audio_base64 must be provided" };
      }
      try {
        const instance = await loadAdapter(args.adapter);
        return await instance.transcribe({
          audioUrl: args.audio_url,
          audioBase64: args.audio_base64,
          filename: args.filename,
          language: args.language,
        });
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
