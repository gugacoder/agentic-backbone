import { tool } from "ai";
import { z } from "zod";

export function createWhatsappListGroupsTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_list_groups: tool({
      description: "Lista todos os grupos do WhatsApp.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a usar"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          return await client.get(`/group/fetchAllGroups/${args.instance}`);
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
