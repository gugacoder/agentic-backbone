import { tool } from "ai";
import { z } from "zod";

export function createWhatsappSendPollTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_send_poll: tool({
      description: "Envia uma enquete (poll) via WhatsApp.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a usar"),
        number: z.string().describe("Numero do destinatario no formato internacional sem + (ex: 5532988887777)"),
        name: z.string().describe("Pergunta da enquete"),
        values: z.array(z.string()).min(2).max(10).describe("Opcoes da enquete (2 a 10)"),
        selectableCount: z.number().min(0).max(10).optional().describe("Quantas opcoes podem ser selecionadas (0 = ilimitado, default 1)"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          const { instance, ...body } = args;
          return await client.send(`/message/sendPoll/${instance}`, body);
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
