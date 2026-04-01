import { tool } from "ai";
import { z } from "zod";
import { mkdirSync, writeFileSync, existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { formatError } from "../../../utils/errors.js";
import { DATA_DIR } from "../../../context/paths.js";

const DRAFTS_DIR = join(DATA_DIR, "email-drafts");

const FLAG_MAP: Record<string, string> = {
  seen: "\\Seen",
  flagged: "\\Flagged",
  answered: "\\Answered",
  draft: "\\Draft",
};

interface EmailDraft {
  draftId: string;
  adapter: string;
  to: string | string[];
  subject: string;
  body: string;
  html?: string;
  cc?: string[];
  reply_to?: string;
  in_reply_to?: string;
  references?: string;
  attachments?: Array<{ filename: string; content_base64: string }>;
  createdAt: string;
}

const WRITE_ACTIONS = new Set([
  "send",
  "move",
  "delete",
  "manage_flags",
  "draft_create",
  "draft_send",
]);

// --- Action schemas ---

const sendParams = z.object({
  action: z.literal("send"),
  to: z.union([z.string(), z.array(z.string())]).describe("Destinatário(s)"),
  subject: z.string().describe("Assunto"),
  body: z.string().describe("Corpo em texto puro"),
  html: z.string().optional().describe("Corpo em HTML (alternativa rica ao body)"),
  cc: z.array(z.string()).optional().describe("Cópias"),
  bcc: z.array(z.string()).optional().describe("Cópias ocultas"),
  reply_to: z.string().optional().describe("Endereço de resposta"),
  in_reply_to: z.string().optional().describe("Message-ID para threading"),
  references: z.string().optional().describe("Message-IDs da thread"),
  attachments: z
    .array(z.object({ filename: z.string(), content_base64: z.string() }))
    .optional()
    .describe("Anexos em base64"),
});

const searchParams = z.object({
  action: z.literal("search"),
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
});

const readParams = z.object({
  action: z.literal("read"),
  uid: z.number().describe("UID do email"),
  mailbox: z.string().optional().describe("Pasta (default: INBOX)"),
  prefer_html: z.boolean().optional().describe("Retornar HTML em vez de texto puro"),
});

const downloadAttachmentParams = z.object({
  action: z.literal("download_attachment"),
  uid: z.number().describe("UID do email"),
  part_id: z.string().describe("Part ID do anexo (obtido via action read)"),
  mailbox: z.string().optional().describe("Pasta (default: INBOX)"),
});

const manageFlagsParams = z.object({
  action: z.literal("manage_flags"),
  uids: z.array(z.number()).describe("UIDs dos emails"),
  flag_action: z.enum(["add", "remove"]).describe("Ação: adicionar ou remover flags"),
  flags: z
    .array(z.enum(["seen", "flagged", "answered", "draft"]))
    .describe("Flags a gerenciar"),
  mailbox: z.string().optional().describe("Pasta (default: INBOX)"),
});

const moveParams = z.object({
  action: z.literal("move"),
  uids: z.array(z.number()).describe("UIDs dos emails"),
  dest_mailbox: z.string().describe("Pasta de destino"),
  source_mailbox: z.string().optional().describe("Pasta de origem (default: INBOX)"),
});

const deleteParams = z.object({
  action: z.literal("delete"),
  uids: z.array(z.number()).describe("UIDs dos emails a excluir"),
  mailbox: z.string().optional().describe("Pasta (default: INBOX)"),
});

const listMailboxesParams = z.object({
  action: z.literal("list_mailboxes"),
});

const draftCreateParams = z.object({
  action: z.literal("draft_create"),
  to: z.union([z.string(), z.array(z.string())]).describe("Destinatário(s)"),
  subject: z.string().describe("Assunto"),
  body: z.string().describe("Corpo em texto puro"),
  html: z.string().optional().describe("Corpo em HTML"),
  cc: z.array(z.string()).optional().describe("Cópias"),
  reply_to: z.string().optional().describe("Endereço de resposta"),
  in_reply_to: z.string().optional().describe("Message-ID para threading"),
  references: z.string().optional().describe("Message-IDs da thread"),
  attachments: z
    .array(z.object({ filename: z.string(), content_base64: z.string() }))
    .optional()
    .describe("Anexos em base64"),
});

const draftSendParams = z.object({
  action: z.literal("draft_send"),
  draft_id: z.string().describe("ID do rascunho a enviar"),
});

const paramsSchema = z.discriminatedUnion("action", [
  sendParams,
  searchParams,
  readParams,
  downloadAttachmentParams,
  manageFlagsParams,
  moveParams,
  deleteParams,
  listMailboxesParams,
  draftCreateParams,
  draftSendParams,
]);

export function createEmailTool(slugs: [string, ...string[]]): Record<string, any> {
  const defaultSlug = slugs[0];

  return {
    email: tool({
      description: [
        "Gerencia emails via SMTP/IMAP.",
        "Ações: send (envia email), search (busca emails), read (lê email completo), download_attachment (baixa anexo),",
        "manage_flags (gerencia flags lido/marcado), move (move entre pastas), delete (exclui permanentemente),",
        "list_mailboxes (lista pastas), draft_create (cria rascunho para revisão), draft_send (envia rascunho).",
      ].join(" "),
      parameters: paramsSchema.and(
        z.object({
          adapter: z.enum(slugs).optional().describe("Slug do adapter email"),
        })
      ),
      execute: async (args) => {
        try {
          const adapterSlug = args.adapter ?? defaultSlug;

          // Policy check for write actions
          if (WRITE_ACTIONS.has(args.action)) {
            const { connectorRegistry } = await import("../../index.js");
            const adapterInfo = connectorRegistry.findAdapter(adapterSlug);
            if (!adapterInfo) return { error: `Adapter "${adapterSlug}" not found` };
            if (adapterInfo.policy === "readonly") {
              return { error: `Adapter "${adapterSlug}" is readonly — action "${args.action}" not allowed` };
            }
          }

          // Helper to build client
          async function buildClient() {
            const { connectorRegistry } = await import("../../index.js");
            const adapterInfo = connectorRegistry.findAdapter(adapterSlug);
            if (!adapterInfo) throw new Error(`Adapter "${adapterSlug}" not found`);
            const { credentialSchema, optionsSchema } = await import("../schemas.js");
            const cred = credentialSchema.parse(adapterInfo.credential);
            const opts = optionsSchema.parse(adapterInfo.options);
            const { createEmailClient } = await import("../client.js");
            return { client: createEmailClient(cred, opts), cred, opts };
          }

          switch (args.action) {
            case "send": {
              const { client, cred, opts } = await buildClient();
              return await client.sendSmtp({
                from: cred.smtp_user,
                fromName: opts.from_name || cred.smtp_user,
                to: args.to,
                subject: args.subject,
                text: args.body,
                html: args.html,
                cc: args.cc,
                bcc: args.bcc,
                replyTo: args.reply_to,
                inReplyTo: args.in_reply_to,
                references: args.references,
                attachments: args.attachments?.map((a) => ({
                  filename: a.filename,
                  content: a.content_base64,
                  encoding: "base64" as const,
                })),
              });
            }

            case "search": {
              const { client, opts } = await buildClient();
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
            }

            case "read": {
              const { client, opts } = await buildClient();
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
                attachments:
                  email.attachments
                    .map((a) => `${a.filename} (${a.contentType}, ${a.size} bytes, part_id=${a.partId})`)
                    .join("; ") || "nenhum",
              };
            }

            case "download_attachment": {
              const { client, opts } = await buildClient();
              return await client.downloadAttachment(
                args.mailbox ?? opts.mailbox,
                args.uid,
                args.part_id
              );
            }

            case "manage_flags": {
              const { client, opts } = await buildClient();
              const imapFlags = args.flags.map((f) => FLAG_MAP[f]);
              await client.setFlags(args.mailbox ?? opts.mailbox, args.uids, imapFlags, args.flag_action);
              return {
                ok: true,
                action: args.flag_action,
                flags: args.flags.join(", "),
                uids: args.uids.join(", "),
              };
            }

            case "move": {
              const { client, opts } = await buildClient();
              await client.moveMessages(
                args.source_mailbox ?? opts.mailbox,
                args.uids,
                args.dest_mailbox
              );
              return {
                ok: true,
                moved: args.uids.length,
                from: args.source_mailbox ?? opts.mailbox,
                to: args.dest_mailbox,
              };
            }

            case "delete": {
              const { client, opts } = await buildClient();
              await client.deleteMessages(args.mailbox ?? opts.mailbox, args.uids);
              return { ok: true, deleted: args.uids.length };
            }

            case "list_mailboxes": {
              const { client } = await buildClient();
              const mailboxes = await client.listMailboxes();
              return {
                mailboxes: mailboxes
                  .map((mb) => `${mb.path}${mb.specialUse ? ` (${mb.specialUse})` : ""}`)
                  .join(", "),
              };
            }

            case "draft_create": {
              const draftId = randomUUID();
              const adapterDir = join(DRAFTS_DIR, adapterSlug);
              mkdirSync(adapterDir, { recursive: true });
              const draft: EmailDraft = {
                draftId,
                adapter: adapterSlug,
                to: args.to,
                subject: args.subject,
                body: args.body,
                html: args.html,
                cc: args.cc,
                reply_to: args.reply_to,
                in_reply_to: args.in_reply_to,
                references: args.references,
                attachments: args.attachments,
                createdAt: new Date().toISOString(),
              };
              writeFileSync(join(adapterDir, `${draftId}.json`), JSON.stringify(draft, null, 2), "utf8");
              return { draftId, message: "Rascunho salvo. Use action draft_send para enviar." };
            }

            case "draft_send": {
              const draftPath = join(DRAFTS_DIR, adapterSlug, `${args.draft_id}.json`);
              if (!existsSync(draftPath)) {
                return { error: `Draft "${args.draft_id}" not found for adapter "${adapterSlug}"` };
              }
              const draft: EmailDraft = JSON.parse(readFileSync(draftPath, "utf8"));
              const { client, cred, opts } = await buildClient();
              const result = await client.sendSmtp({
                from: cred.smtp_user,
                fromName: opts.from_name || cred.smtp_user,
                to: draft.to,
                subject: draft.subject,
                text: draft.body,
                html: draft.html,
                cc: draft.cc,
                replyTo: draft.reply_to,
                inReplyTo: draft.in_reply_to,
                references: draft.references,
                attachments: draft.attachments?.map((a) => ({
                  filename: a.filename,
                  content: a.content_base64,
                  encoding: "base64" as const,
                })),
              });
              unlinkSync(draftPath);
              return { ...result, draftId: args.draft_id, message: "Rascunho enviado e removido." };
            }
          }
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
