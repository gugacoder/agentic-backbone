import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createListVoicesTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    elevenlabs_list_voices: tool({
      description: "List available voices in ElevenLabs account.",
      parameters: z.object({
        adapter: z.enum(slugs).optional().describe("ElevenLabs adapter slug to use"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapterSlug = args.adapter ?? defaultSlug;
          const client = connectorRegistry.createClient(adapterSlug) as any;
          const voices = await client.listVoices();
          return { voices };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
