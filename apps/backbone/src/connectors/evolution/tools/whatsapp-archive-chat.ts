import { tool } from "ai";
import { z } from "zod";

export function createWhatsappArchiveChatTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_archive_chat: tool({
      description: "Arquiva ou desarquiva um chat no WhatsApp.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a usar"),
        chat: z.string().describe("JID do chat (numero@s.whatsapp.net ou grupo@g.us)"),
        archive: z.boolean().describe("true para arquivar, false para desarquivar"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          return await client.send(`/chat/archiveChat/${args.instance}`, {
            chat: args.chat,
            archive: args.archive,
          });
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
