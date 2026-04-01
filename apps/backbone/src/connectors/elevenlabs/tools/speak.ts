import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createSpeakTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    elevenlabs_speak: tool({
      description: "Convert text to speech using ElevenLabs TTS. Saves audio to a file and returns the path.",
      parameters: z.object({
        text: z.string().describe("Text to convert to speech"),
        voice_id: z.string().optional().describe("ElevenLabs voice ID (optional, uses adapter default)"),
        adapter: z.enum(slugs).optional().describe("ElevenLabs adapter slug to use"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapterSlug = args.adapter ?? defaultSlug;
          const client = connectorRegistry.createClient(adapterSlug) as any;
          const result = await client.speak(args.text, args.voice_id);
          return { file_path: result.file_path, message: `Audio saved: ${result.file_path} (${result.size_bytes} bytes)` };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
