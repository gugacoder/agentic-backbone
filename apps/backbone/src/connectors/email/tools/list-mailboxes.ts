import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createEmailListMailboxesTool(slugs: [string, ...string[]]): Record<string, any> {
  return {
    email_list_mailboxes: tool({
      description:
        "Lista todas as pastas/mailboxes da conta de email. Retorna path, nome e uso especial (inbox, sent, trash, etc).",
      parameters: z.object({
        adapter: z.enum(slugs).describe("Email adapter slug"),
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

          const mailboxes = await client.listMailboxes();
          return {
            mailboxes: mailboxes.map((mb) =>
              `${mb.path}${mb.specialUse ? ` (${mb.specialUse})` : ""}`
            ).join(", "),
          };
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
