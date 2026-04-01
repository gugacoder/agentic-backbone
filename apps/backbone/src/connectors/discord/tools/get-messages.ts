import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createDiscordGetMessagesTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    discord_get_messages: tool({
      description: "Lê mensagens recentes de um canal Discord.",
      parameters: z.object({
        channel_id: z.string().describe("ID do canal Discord"),
        limit: z.number().optional().default(20).describe("Número de mensagens a retornar (máximo 100)"),
        before: z.string().optional().describe("ID de mensagem para paginação (retorna mensagens antes desta)"),
        adapter: z.enum(slugs).optional().describe("Slug do adapter Discord a usar"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapterSlug = args.adapter ?? defaultSlug;
          const client = connectorRegistry.createClient(adapterSlug) as any;
          const params = new URLSearchParams({ limit: String(args.limit ?? 20) });
          if (args.before) params.set("before", args.before);
          const messages = await client.request(`/channels/${args.channel_id}/messages?${params}`);
          return { messages };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
