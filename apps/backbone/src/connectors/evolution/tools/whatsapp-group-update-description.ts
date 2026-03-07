import { tool } from "ai";
import { z } from "zod";

export function createWhatsappGroupUpdateDescriptionTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_group_update_description: tool({
      description: "Altera a descricao de um grupo no WhatsApp.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a usar"),
        groupJid: z.string().describe("JID do grupo (ex: 120363000000000000@g.us)"),
        description: z.string().describe("Nova descricao do grupo"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          return await client.send(`/group/updateGroupDescription/${args.instance}`, {
            groupJid: args.groupJid,
            description: args.description,
          });
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
