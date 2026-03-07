import { tool } from "ai";
import { z } from "zod";

export function createWhatsappFindContactsTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_find_contacts: tool({
      description: "Busca contatos salvos no WhatsApp.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a usar"),
        where: z.record(z.unknown()).optional().describe(
          "Filtro de busca. Ex: { id: 'numero@s.whatsapp.net' }"
        ),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          return await client.send(`/chat/findContacts/${args.instance}`, {
            where: args.where,
          });
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
