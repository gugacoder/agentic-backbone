import { tool } from "ai";
import { z } from "zod";

export function createWhatsappMarkAsReadTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_mark_as_read: tool({
      description: "Marca mensagens como lidas no WhatsApp.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a usar"),
        readMessages: z.array(z.object({
          id: z.string().describe("ID da mensagem"),
          remoteJid: z.string().describe("JID do chat (numero@s.whatsapp.net ou grupo@g.us)"),
        })).describe("Lista de mensagens a marcar como lidas"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          return await client.send(`/chat/markMessageAsRead/${args.instance}`, {
            readMessages: args.readMessages,
          });
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
