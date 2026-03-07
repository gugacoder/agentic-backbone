import { tool } from "ai";
import { z } from "zod";

export function createWhatsappFindMessagesTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_find_messages: tool({
      description: "Busca mensagens no historico do WhatsApp.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a usar"),
        where: z.record(z.unknown()).describe(
          "Filtro de busca. Ex: { key: { remoteJid: 'numero@s.whatsapp.net' } }"
        ),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          return await client.send(`/chat/findMessages/${args.instance}`, {
            where: args.where,
          });
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
