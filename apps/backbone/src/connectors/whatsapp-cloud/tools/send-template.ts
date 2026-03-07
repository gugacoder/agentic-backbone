import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { credentialSchema, optionsSchema } from "../schemas.js";
import { createWhatsAppCloudClient } from "../client.js";

export function createSendWhatsAppTemplateTool(slugs: [string, ...string[]]) {
  return {
    send_whatsapp_template: tool({
      description: "Envia um template aprovado via WhatsApp Cloud API.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Slug do adapter whatsapp-cloud a usar"),
        to: z.string().describe("Numero do destinatario no formato internacional (ex: 5511999999999)"),
        templateName: z.string().describe("Nome do template aprovado no Meta Business Manager"),
        languageCode: z.string().optional().default("pt_BR").describe("Codigo de idioma do template (ex: pt_BR, en_US)"),
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
          const messageId = await client.sendTemplate(args.to, args.templateName, args.languageCode);
          return { ok: true, messageId };
        } catch (err) {
          return { ok: false, error: formatError(err) };
        }
      },
    }),
  };
}
