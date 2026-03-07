import { tool } from "ai";
import { z } from "zod";

export function createWhatsappGroupUpdateParticipantTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_group_update_participant: tool({
      description: "Adiciona, remove, promove ou rebaixa participantes de um grupo no WhatsApp.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a usar"),
        groupJid: z.string().describe("JID do grupo (ex: 120363000000000000@g.us)"),
        participants: z.array(z.string()).describe("Lista de numeros dos participantes no formato internacional sem +"),
        action: z.enum(["add", "remove", "promote", "demote"]).describe("Acao: add (adicionar), remove (remover), promote (promover a admin), demote (rebaixar de admin)"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          return await client.send(`/group/updateParticipant/${args.instance}`, {
            groupJid: args.groupJid,
            participants: args.participants,
            action: args.action,
          });
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
