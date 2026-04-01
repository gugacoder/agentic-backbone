import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { credentialSchema, optionsSchema } from "../schemas.js";
import { createWhatsAppCloudClient } from "../client.js";

export function createSendWhatsAppTextTool(slugs: [string, ...string[]]) {
  return {
    send_whatsapp_text: tool({
      description: "Envia uma mensagem de texto via WhatsApp Cloud API.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Slug do adapter whatsapp-cloud a usar"),
        to: z.string().describe("Numero do destinatario no formato internacional (ex: 5511999999999)"),
        body: z.string().describe("Texto da mensagem"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapter = connectorRegistry.findAdapter(args.instance);
          if (!adapter) throw new Error(`Adapter "${args.instance}" not found`);
          const cred = credentialSchema.parse(adapter.credential);
          const opts = optionsSchema.safeParse(adapter.options);
          const client = createWhatsAppCloudClient(
            cred,
            opts.success ? opts.data : { api_version: "v19.0", auto_reply_read: false }
          );
          const messageId = await client.sendText(args.to, args.body);
          return { ok: true, messageId };
        } catch (err) {
          return { ok: false, error: formatError(err) };
        }
      },
    }),
  };
}
