import { tool } from "ai";
import { z } from "zod";

export function createWhatsappListInstancesTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_list_instances: tool({
      description: "Lista todas as instancias WhatsApp disponiveis na Evolution API.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a usar para autenticacao"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          return await client.get(`/instance/fetchInstances`);
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
