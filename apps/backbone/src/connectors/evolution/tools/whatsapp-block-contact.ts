import { tool } from "ai";
import { z } from "zod";

export function createWhatsappBlockContactTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_block_contact: tool({
      description: "Bloqueia ou desbloqueia um contato no WhatsApp.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a usar"),
        number: z.string().describe("Numero do contato no formato internacional sem + (ex: 5532988887777)"),
        action: z.enum(["block", "unblock"]).describe("Acao: block (bloquear) ou unblock (desbloquear)"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          return await client.send(`/chat/updateBlockStatus/${args.instance}`, {
            number: args.number,
            action: args.action,
          });
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
