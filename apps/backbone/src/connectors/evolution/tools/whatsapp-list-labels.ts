import { tool } from "ai";
import { z } from "zod";

export function createWhatsappListLabelsTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_list_labels: tool({
      description: "Lista todas as labels (etiquetas) do WhatsApp Business.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a usar"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          return await client.get(`/label/findLabels/${args.instance}`);
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
