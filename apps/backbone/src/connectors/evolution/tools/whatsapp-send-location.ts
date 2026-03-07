import { tool } from "ai";
import { z } from "zod";

export function createWhatsappSendLocationTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_send_location: tool({
      description: "Envia uma localizacao via WhatsApp.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a usar"),
        number: z.string().describe("Numero do destinatario no formato internacional sem + (ex: 5532988887777)"),
        latitude: z.number().describe("Latitude da localizacao"),
        longitude: z.number().describe("Longitude da localizacao"),
        name: z.string().describe("Nome do local"),
        address: z.string().describe("Endereco do local"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          const { instance, ...body } = args;
          return await client.send(`/message/sendLocation/${instance}`, body);
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
