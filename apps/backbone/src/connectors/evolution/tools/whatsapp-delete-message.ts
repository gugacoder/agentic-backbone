import { tool } from "ai";
import { z } from "zod";

export function createWhatsappDeleteMessageTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_delete_message: tool({
      description: "Apaga uma mensagem para todos no WhatsApp.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a usar"),
        remoteJid: z.string().describe("JID do chat (numero@s.whatsapp.net ou grupo@g.us)"),
        messageId: z.string().describe("ID da mensagem a apagar"),
        fromMe: z.boolean().describe("Se a mensagem foi enviada por nos"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          return await client.send(`/chat/deleteMessageForEveryone/${args.instance}`, {
            remoteJid: args.remoteJid,
            messageId: args.messageId,
            fromMe: args.fromMe,
          });
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
