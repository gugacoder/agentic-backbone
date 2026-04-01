import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createDiscordSendMessageTool(adapters: { slug: string; policy: string }[]): Record<string, any> {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    discord_send_message: tool({
      description: "Envia uma mensagem em um canal Discord.",
      parameters: z.object({
        channel_id: z.string().describe("ID do canal Discord"),
        content: z.string().describe("Conteúdo da mensagem"),
        adapter: z.enum(slugs).optional().describe("Slug do adapter Discord a usar"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapterSlug = args.adapter ?? defaultSlug;
          const client = connectorRegistry.createClient(adapterSlug) as any;
          const message = await client.request(`/channels/${args.channel_id}/messages`, {
            method: "POST",
            body: JSON.stringify({ content: args.content }),
          });
          return { message_id: message.id, channel_id: message.channel_id };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
