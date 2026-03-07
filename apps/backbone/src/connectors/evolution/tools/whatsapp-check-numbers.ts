import { tool } from "ai";
import { z } from "zod";

export function createWhatsappCheckNumbersTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_check_numbers: tool({
      description: "Verifica se numeros de telefone possuem WhatsApp.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a usar"),
        numbers: z.array(z.string()).describe("Lista de numeros a verificar no formato internacional sem + (ex: ['5532988887777'])"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          return await client.send(`/chat/whatsappNumbers/${args.instance}`, {
            numbers: args.numbers,
          });
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
