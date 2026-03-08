import { z } from "zod";

export const credentialSchema = z.object({
  imap_host: z.string().describe("IMAP server hostname (e.g. imap.gmail.com)"),
  imap_port: z.number().int().default(993).describe("IMAP port (993 for SSL, 143 for STARTTLS)"),
  imap_user: z.string().describe("IMAP username / email address"),
  imap_pass: z.string().describe("IMAP password or app password"),
  smtp_host: z.string().describe("SMTP server hostname (e.g. smtp.gmail.com)"),
  smtp_port: z.number().int().default(587).describe("SMTP port (465 for SSL, 587 for STARTTLS)"),
  smtp_secure: z.boolean().default(false).describe("Use SSL/TLS (true for port 465)"),
  smtp_user: z.string().describe("SMTP username / email address"),
  smtp_pass: z.string().describe("SMTP password or app password"),
});

export const optionsSchema = z.object({
  agent_id: z.string().describe("Agent ID to handle incoming emails"),
  mailbox: z.string().default("INBOX").describe("IMAP mailbox to monitor"),
  poll_interval_seconds: z.number().int().default(60).describe("Polling interval in seconds"),
  mark_seen: z.boolean().default(true).describe("Mark emails as read after processing"),
  reply_prefix: z.string().default("").describe("Prefix added to agent replies (e.g. '[Auto] ')"),
  from_name: z.string().default("").describe("Display name for outgoing emails"),
  sender_whitelist: z
    .array(z.string())
    .default([])
    .describe("If non-empty, only process emails from these addresses"),
  subject_filter: z
    .string()
    .default("")
    .describe("Optional regex — only process emails whose subject matches"),
  auto_reply: z.boolean().default(true).describe("Send agent response via SMTP"),
});

export type EmailCredential = z.infer<typeof credentialSchema>;
export type EmailOptions = z.infer<typeof optionsSchema>;
