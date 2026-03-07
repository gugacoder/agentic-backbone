import { tool } from "ai";
import { z } from "zod";

export function createWhatsappSendTextTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_send_text: tool({
      description: "Envia uma mensagem de texto via WhatsApp.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a usar"),
        number: z.string().describe("Numero do destinatario no formato internacional sem + (ex: 5532988887777)"),
        text: z.string().describe("Texto da mensagem"),
        delay: z.number().optional().describe("Atraso em ms antes de enviar (simula digitacao)"),
        linkPreview: z.boolean().optional().describe("Se deve gerar preview de links"),
        quoted: z.object({
          key: z.object({
            id: z.string().describe("ID da mensagem citada"),
            remoteJid: z.string().describe("JID do chat"),
            fromMe: z.boolean().describe("Se a mensagem citada foi enviada por nos"),
          }),
        }).optional().describe("Mensagem a citar (reply)"),
        mentioned: z.array(z.string()).optional().describe("Lista de numeros a mencionar"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          const { instance, ...body } = args;
          return await client.send(`/message/sendText/${instance}`, body);
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
