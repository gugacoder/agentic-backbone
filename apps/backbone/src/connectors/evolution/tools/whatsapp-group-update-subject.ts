import { tool } from "ai";
import { z } from "zod";

export function createWhatsappGroupUpdateSubjectTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_group_update_subject: tool({
      description: "Altera o nome (assunto) de um grupo no WhatsApp.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a usar"),
        groupJid: z.string().describe("JID do grupo (ex: 120363000000000000@g.us)"),
        subject: z.string().describe("Novo nome do grupo"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          return await client.send(`/group/updateGroupSubject/${args.instance}`, {
            groupJid: args.groupJid,
            subject: args.subject,
          });
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
