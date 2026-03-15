import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createEmailReadTool(slugs: [string, ...string[]]): Record<string, any> {
  return {
    email_read: tool({
      description:
        "Lê o conteúdo completo de um email pelo UID. Retorna corpo (texto ou HTML), metadados e lista de anexos. Use após email_search.",
      parameters: z.object({
        adapter: z.enum(slugs).describe("Email adapter slug"),
        uid: z.number().describe("UID do email"),
        mailbox: z.string().optional().describe("Pasta (default: INBOX)"),
        prefer_html: z.boolean().optional().describe("Retornar HTML em vez de texto puro"),
      }),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const adapter = connectorRegistry.findAdapter(args.adapter);
          if (!adapter) return { error: `Adapter "${args.adapter}" not found` };

          const { credentialSchema, optionsSchema } = await import("../schemas.js");
          const cred = credentialSchema.parse(adapter.credential);
          const opts = optionsSchema.parse(adapter.options);

          const { createEmailClient } = await import("../client.js");
          const client = createEmailClient(cred, opts);

          const email = await client.fetchByUid(args.mailbox ?? opts.mailbox, args.uid);
          if (!email) return { error: `Email UID ${args.uid} not found` };

          const body = args.prefer_html && email.bodyHtml ? email.bodyHtml : email.bodyText;

          return {
            uid: email.uid,
            messageId: email.messageId,
            inReplyTo: email.inReplyTo,
            references: email.references.join(" "),
            from: email.fromName ? `${email.fromName} <${email.from}>` : email.from,
            to: email.to.join(", "),
            cc: email.cc.length > 0 ? email.cc.join(", ") : undefined,
            subject: email.subject,
            date: email.date?.toISOString() ?? null,
            body,
            bodyFormat: args.prefer_html && email.bodyHtml ? "html" : "text",
            hasHtml: email.bodyHtml !== null,
            attachments: email.attachments.map((a) =>
              `${a.filename} (${a.contentType}, ${a.size} bytes, part_id=${a.partId})`
            ).join("; ") || "nenhum",
          };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
