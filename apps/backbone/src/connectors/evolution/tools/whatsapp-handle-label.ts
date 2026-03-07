import { tool } from "ai";
import { z } from "zod";

export function createWhatsappHandleLabelTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_handle_label: tool({
      description: "Adiciona ou remove uma label (etiqueta) de um chat no WhatsApp Business.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a usar"),
        number: z.string().describe("Numero do contato no formato internacional sem + (ex: 5532988887777)"),
        labelId: z.string().describe("ID da label a aplicar ou remover"),
        action: z.enum(["add", "remove"]).describe("Acao: add (adicionar label) ou remove (remover label)"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          return await client.send(`/label/handleLabel/${args.instance}`, {
            number: args.number,
            labelId: args.labelId,
            action: args.action,
          });
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
