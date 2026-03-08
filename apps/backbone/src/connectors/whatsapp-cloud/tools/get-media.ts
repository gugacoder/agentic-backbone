import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";
import { credentialSchema, optionsSchema } from "../schemas.js";
import { createWhatsAppCloudClient } from "../client.js";

export function createGetWhatsAppMediaTool(slugs: [string, ...string[]]) {
  return {
    get_whatsapp_media: tool({
      description: "Recupera a URL e mimeType de uma midia recebida via WhatsApp Cloud API.",
      parameters: z.object({
        instance: z.enum(slugs).describe("Slug do adapter whatsapp-cloud a usar"),
        mediaId: z.string().describe("ID da midia retornado pelo webhook do WhatsApp"),
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
          const { url, mimeType } = await client.getMediaUrl(args.mediaId);
          return { ok: true, url, mimeType };
        } catch (err) {
          return { ok: false, error: formatError(err) };
        }
      },
    }),
  };
}
