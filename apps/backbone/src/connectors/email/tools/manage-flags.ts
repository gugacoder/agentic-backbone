import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

const FLAG_MAP: Record<string, string> = {
  seen: "\\Seen",
  flagged: "\\Flagged",
  answered: "\\Answered",
  draft: "\\Draft",
};

export function createEmailManageFlagsTool(slugs: [string, ...string[]]): Record<string, any> {
  return {
    email_manage_flags: tool({
      description:
        "Gerencia flags de emails (lido, marcado, respondido, rascunho). Mapeia para flags IMAP padrão.",
      parameters: z.object({
        adapter: z.enum(slugs).describe("Email adapter slug"),
        uids: z.array(z.number()).describe("UIDs dos emails"),
        action: z.enum(["add", "remove"]).describe("Ação: adicionar ou remover flags"),
        flags: z
          .array(z.enum(["seen", "flagged", "answered", "draft"]))
          .describe("Flags a gerenciar"),
        mailbox: z.string().optional().describe("Pasta (default: INBOX)"),
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

          const imapFlags = args.flags.map((f) => FLAG_MAP[f]);

          await client.setFlags(
            args.mailbox ?? opts.mailbox,
            args.uids,
            imapFlags,
            args.action
          );

          return {
            ok: true,
            action: args.action,
            flags: args.flags.join(", "),
            uids: args.uids.join(", "),
          };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
