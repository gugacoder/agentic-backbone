import { tool } from "ai";
import { z } from "zod";

export function createWhatsappFetchProfileTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_fetch_profile: tool({
      description: "Busca o perfil de um contato no WhatsApp (foto, status, nome).",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a usar"),
        number: z.string().describe("Numero do contato no formato internacional sem + (ex: 5532988887777)"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          return await client.send(`/chat/fetchProfile/${args.instance}`, {
            number: args.number,
          });
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
