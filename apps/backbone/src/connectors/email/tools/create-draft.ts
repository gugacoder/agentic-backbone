import { tool } from "ai";
import { z } from "zod";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const DRAFTS_DIR = join(process.cwd(), "data", "email-drafts");

export interface EmailDraft {
  draftId: string;
  adapter: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  createdAt: string;
}

export function createEmailCreateDraftTool(slugs: [string, ...string[]]): Record<string, any> {
  return {
    create_email_draft: tool({
      description:
        "Create an email draft without sending it. The draft is stored locally and can be reviewed before sending with send_email_reply. Use this when you want to compose an email but need human review first.",
      parameters: z.object({
        adapter: z.enum(slugs).describe("Email adapter slug"),
        to: z.string().describe("Recipient email address"),
        subject: z.string().describe("Email subject line"),
        body: z.string().describe("Plain-text email body"),
        inReplyTo: z
          .string()
          .optional()
          .describe("Message-ID of the email this draft replies to"),
      }),
      execute: async (args) => {
        try {
          const draftId = randomUUID();
          const adapterDir = join(DRAFTS_DIR, args.adapter);
          mkdirSync(adapterDir, { recursive: true });

          const draft: EmailDraft = {
            draftId,
            adapter: args.adapter,
            to: args.to,
            subject: args.subject,
            body: args.body,
            inReplyTo: args.inReplyTo,
            createdAt: new Date().toISOString(),
          };

          writeFileSync(join(adapterDir, `${draftId}.json`), JSON.stringify(draft, null, 2), "utf8");

          return { draftId, message: "Draft saved. Use send_email_reply to send it." };
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
  };
}
