import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createDiscordListChannelsTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    discord_list_channels: tool({
      description: "Lista canais de um servidor Discord.",
      parameters: z.object({
        guild_id: z.string().optional().describe("ID do servidor Discord (usa default do adapter se omitido)"),
        adapter: z.enum(slugs).optional().describe("Slug do adapter Discord a usar"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapterSlug = args.adapter ?? defaultSlug;
          const client = connectorRegistry.createClient(adapterSlug) as any;
          const guildId = args.guild_id ?? client.defaultGuildId;
          if (!guildId) return { error: "guild_id não especificado e sem default configurado" };
          const channels = await client.request(`/guilds/${guildId}/channels`);
          return { channels };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
