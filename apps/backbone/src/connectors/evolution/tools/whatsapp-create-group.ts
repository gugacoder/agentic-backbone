import { tool } from "ai";
import { z } from "zod";

export function createWhatsappCreateGroupTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_create_group: tool({
      description: "Cria um novo grupo no WhatsApp.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a usar"),
        subject: z.string().describe("Nome do grupo"),
        participants: z.array(z.string()).describe("Lista de numeros dos participantes no formato internacional sem +"),
        description: z.string().optional().describe("Descricao do grupo"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          const { instance, ...body } = args;
          return await client.send(`/group/create/${instance}`, body);
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
