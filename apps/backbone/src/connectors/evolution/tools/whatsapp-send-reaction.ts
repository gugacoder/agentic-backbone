import { tool } from "ai";
import { z } from "zod";

const messageKeySchema = z.object({
  id: z.string().describe("ID da mensagem a reagir"),
  remoteJid: z.string().describe("JID do chat (numero@s.whatsapp.net ou grupo@g.us)"),
  fromMe: z.boolean().describe("Se a mensagem foi enviada por nos"),
});

export function createWhatsappSendReactionTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_send_reaction: tool({
      description: "Envia uma reacao (emoji) a uma mensagem no WhatsApp.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a usar"),
        key: messageKeySchema.describe("Chave da mensagem a reagir"),
        reaction: z.string().describe("Emoji da reacao (ex: \ud83d\udc4d). Envie string vazia para remover reacao"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          return await client.send(`/message/sendReaction/${args.instance}`, {
            key: args.key,
            reaction: args.reaction,
          });
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
