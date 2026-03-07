import { tool } from "ai";
import { z } from "zod";

export function createWhatsappFindChatsTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_find_chats: tool({
      description: "Lista todos os chats do WhatsApp.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Instancia do WhatsApp a usar"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.instance);
          return await client.send(`/chat/findChats/${args.instance}`, {});
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
