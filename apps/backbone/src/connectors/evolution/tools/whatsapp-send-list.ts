import { tool } from "ai";
import { z } from "zod";

const listSectionSchema = z.object({
  title: z.string().describe("Titulo da secao"),
  rows: z.array(z.object({
    title: z.string().describe("Titulo da opcao"),
    description: z.string().optional().describe("Descricao da opcao"),
    rowId: z.string().describe("ID unico da opcao"),
  })).describe("Opcoes dentro da secao"),
});

export function createWhatsappSendListTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_send_list: tool({
      description: "Envia uma mensagem com lista interativa via WhatsApp.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a usar"),
        number: z.string().describe("Numero do destinatario no formato internacional sem + (ex: 5532988887777)"),
        title: z.string().describe("Titulo da lista"),
        footerText: z.string().describe("Texto do rodape"),
        buttonText: z.string().describe("Texto do botao que abre a lista"),
        sections: z.array(listSectionSchema).describe("Secoes da lista"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          const { instance, ...body } = args;
          return await client.send(`/message/sendList/${instance}`, body);
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
