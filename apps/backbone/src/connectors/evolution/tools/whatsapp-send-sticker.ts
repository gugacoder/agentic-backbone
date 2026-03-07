import { tool } from "ai";
import { z } from "zod";

export function createWhatsappSendStickerTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_send_sticker: tool({
      description: "Envia um sticker via WhatsApp.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a usar"),
        number: z.string().describe("Numero do destinatario no formato internacional sem + (ex: 5532988887777)"),
        sticker: z.string().describe("URL publica da imagem do sticker"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          return await client.send(`/message/sendSticker/${args.instance}`, {
            number: args.number,
            sticker: args.sticker,
          });
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
