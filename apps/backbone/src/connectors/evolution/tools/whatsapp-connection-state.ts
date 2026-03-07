import { tool } from "ai";
import { z } from "zod";

export function createWhatsappConnectionStateTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_connection_state: tool({
      description: "Verifica o estado da conexao de uma instancia WhatsApp.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a verificar"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          return await client.get(`/instance/connectionState/${args.instance}`);
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
