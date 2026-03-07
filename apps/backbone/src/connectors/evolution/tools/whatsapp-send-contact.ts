import { tool } from "ai";
import { z } from "zod";

const contactItemSchema = z.object({
  fullName: z.string().describe("Nome completo do contato"),
  wuid: z.string().describe("WhatsApp ID do contato (numero@s.whatsapp.net)"),
  phoneNumber: z.string().describe("Numero de telefone do contato"),
});

export function createWhatsappSendContactTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_send_contact: tool({
      description: "Envia um ou mais contatos (vCard) via WhatsApp.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a usar"),
        number: z.string().describe("Numero do destinatario no formato internacional sem + (ex: 5532988887777)"),
        contact: z.array(contactItemSchema).describe("Lista de contatos a enviar"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          return await client.send(`/message/sendContact/${args.instance}`, {
            number: args.number,
            contact: args.contact,
          });
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
