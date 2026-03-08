import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../../utils/errors.js";

export function createEmailSendReplyTool(slugs: [string, ...string[]]): Record<string, any> {
  return {
    send_email_reply: tool({
      description:
        "Send an email (reply or new) via SMTP. Supports proper threading via In-Reply-To and References headers. Use this to respond to emails received by the email adapter.",
      parameters: z.object({
        adapter: z.enum(slugs).describe("Email adapter slug to send from"),
        to: z.string().describe("Recipient email address"),
        subject: z.string().describe("Email subject line"),
        body: z.string().describe("Plain-text email body"),
        inReplyTo: z
          .string()
          .optional()
          .describe("Message-ID of the email being replied to (sets In-Reply-To header)"),
        references: z
          .string()
          .optional()
          .describe(
            "Space-separated list of Message-IDs for the References header (full thread chain)"
          ),
        cc: z.array(z.string()).optional().describe("CC recipient email addresses"),
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

          return await client.sendSmtp({
            from: cred.smtp_user,
            fromName: opts.from_name || cred.smtp_user,
            to: args.to,
            subject: args.subject,
            text: args.body,
            inReplyTo: args.inReplyTo,
            references: args.references,
          });
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
