import { tool } from "ai";
import { z } from "zod";

export function createWhatsappGroupParticipantsTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_group_participants: tool({
      description: "Lista os participantes de um grupo no WhatsApp.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a usar"),
        groupJid: z.string().describe("JID do grupo (ex: 120363000000000000@g.us)"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          return await client.get(`/group/participants/${args.instance}?groupJid=${args.groupJid}`);
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
