import { tool } from "ai";
import { z } from "zod";

const buttonSchema = z.object({
  buttonId: z.string().describe("ID unico do botao"),
  buttonText: z.object({
    displayText: z.string().describe("Texto exibido no botao"),
  }),
  type: z.literal(1).optional(),
});

export function createWhatsappSendButtonsTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_send_buttons: tool({
      description: "Envia uma mensagem com botoes interativos via WhatsApp.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a usar"),
        number: z.string().describe("Numero do destinatario no formato internacional sem + (ex: 5532988887777)"),
        title: z.string().describe("Titulo da mensagem"),
        description: z.string().describe("Corpo da mensagem"),
        buttons: z.array(buttonSchema).describe("Lista de botoes (max 3)"),
        footer: z.string().optional().describe("Texto do rodape"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          const { instance, ...body } = args;
          return await client.send(`/message/sendButtons/${instance}`, body);
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
