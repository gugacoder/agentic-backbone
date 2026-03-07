import { tool } from "ai";
import { z } from "zod";

export function createWhatsappSendAudioTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_send_audio: tool({
      description: "Envia audio gravado (formato WhatsApp nativo) via WhatsApp.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a usar"),
        number: z.string().describe("Numero do destinatario no formato internacional sem + (ex: 5532988887777)"),
        audio: z.string().describe("URL publica do arquivo de audio"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          return await client.send(`/message/sendWhatsAppAudio/${args.instance}`, {
            number: args.number,
            audio: args.audio,
          });
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
