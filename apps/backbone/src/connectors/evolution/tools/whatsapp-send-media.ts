import { tool } from "ai";
import { z } from "zod";

export function createWhatsappSendMediaTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_send_media: tool({
      description: "Envia midia (imagem, documento, video ou audio) via WhatsApp.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a usar"),
        number: z.string().describe("Numero do destinatario no formato internacional sem + (ex: 5532988887777)"),
        mediatype: z.enum(["image", "document", "video", "audio"]).describe("Tipo da midia"),
        media: z.string().describe("URL publica da midia"),
        caption: z.string().optional().describe("Legenda da midia"),
        fileName: z.string().optional().describe("Nome do arquivo (para documentos)"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          const { instance, ...body } = args;
          return await client.send(`/message/sendMedia/${instance}`, body);
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
