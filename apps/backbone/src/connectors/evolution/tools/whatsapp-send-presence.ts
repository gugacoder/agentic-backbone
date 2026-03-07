import { tool } from "ai";
import { z } from "zod";

export function createWhatsappSendPresenceTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_send_presence: tool({
      description: "Envia indicador de presenca (digitando, gravando audio, pausado) no WhatsApp.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a usar"),
        number: z.string().describe("Numero do destinatario no formato internacional sem + (ex: 5532988887777)"),
        presence: z.enum(["composing", "recording", "paused"]).describe("Tipo de presenca: composing (digitando), recording (gravando audio), paused (parou)"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          return await client.send(`/chat/sendPresence/${args.instance}`, {
            number: args.number,
            presence: args.presence,
          });
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
