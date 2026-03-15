import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createEmailSearchTool(slugs: [string, ...string[]]): Record<string, any> {
  return {
    email_search: tool({
      description:
        "Busca emails via IMAP. Suporta filtros por remetente, destinatário, assunto, data, texto e flags. Retorna metadados e preview do corpo (500 chars). Use email_read para o conteúdo completo.",
      parameters: z.object({
        adapter: z.enum(slugs).describe("Email adapter slug"),
        mailbox: z.string().optional().describe("Pasta (default: INBOX)"),
        from: z.string().optional().describe("Filtrar por remetente"),
        to: z.string().optional().describe("Filtrar por destinatário"),
        subject: z.string().optional().describe("Filtrar por assunto (substring)"),
        text: z.string().optional().describe("Busca full-text no corpo"),
        since: z.string().optional().describe("Emails após data (ISO 8601)"),
        before: z.string().optional().describe("Emails antes de data (ISO 8601)"),
        unseen_only: z.boolean().optional().describe("Apenas não-lidos"),
        flagged_only: z.boolean().optional().describe("Apenas marcados"),
        limit: z.number().optional().describe("Máximo de resultados (default 20)"),
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

          const criteria: Record<string, any> = {};
          if (args.from) criteria.from = args.from;
          if (args.to) criteria.to = args.to;
          if (args.subject) criteria.subject = args.subject;
          if (args.text) criteria.body = args.text;
          if (args.since) criteria.since = new Date(args.since);
          if (args.before) criteria.before = new Date(args.before);
          if (args.unseen_only) criteria.seen = false;
          if (args.flagged_only) criteria.flagged = true;

          const messages = await client.searchMessages(
            args.mailbox ?? opts.mailbox,
            criteria,
            args.limit ?? 20
          );

          return {
            count: messages.length,
            messages: messages.map((m) => ({
              uid: m.uid,
              messageId: m.messageId,
              from: m.fromName ? `${m.fromName} <${m.from}>` : m.from,
              to: m.to.join(", "),
              cc: m.cc.length > 0 ? m.cc.join(", ") : undefined,
              subject: m.subject,
              date: m.date?.toISOString() ?? null,
              bodyPreview: m.bodyText,
              hasAttachments: m.attachments.length > 0,
              attachmentCount: m.attachments.length,
            })),
          };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
