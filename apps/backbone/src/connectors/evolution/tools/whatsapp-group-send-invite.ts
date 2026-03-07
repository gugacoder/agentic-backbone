import { tool } from "ai";
import { z } from "zod";

export function createWhatsappGroupSendInviteTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_group_send_invite: tool({
      description: "Envia convite de grupo para numeros via WhatsApp.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a usar"),
        groupJid: z.string().describe("JID do grupo (ex: 120363000000000000@g.us)"),
        numbers: z.array(z.string()).describe("Lista de numeros a convidar no formato internacional sem +"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          return await client.send(`/group/sendInvite/${args.instance}`, {
            groupJid: args.groupJid,
            numbers: args.numbers,
          });
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
