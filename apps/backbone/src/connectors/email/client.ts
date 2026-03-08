import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import type { EmailCredential, EmailOptions } from "./schemas.js";

// ---- Types ----

export interface ParsedEmail {
  uid: number;
  messageId: string;
  inReplyTo: string | null;
  references: string[];
  from: string;
  fromName: string;
  subject: string;
  bodyText: string;
  date: Date | null;
}

export interface SmtpSendOptions {
  from: string;
  fromName: string;
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string;
  references?: string;
}

// ---- IMAP helpers ----

function parseAddressString(addr: { name?: string; address?: string } | undefined): {
  email: string;
  name: string;
} {
  return {
    email: addr?.address ?? "",
    name: addr?.name ?? addr?.address ?? "",
  };
}

/**
 * Parse raw References header (newline-folded, space-separated message IDs).
 */
function parseReferences(raw: string): string[] {
  return raw
    .replace(/\r?\n\s+/g, " ")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Decode a MIME encoded-word sequence (e.g. =?UTF-8?Q?...?=).
 * Simple implementation for common cases; not full RFC 2047 compliance.
 */
function decodeMimeWords(str: string): string {
  return str.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_match, charset, encoding, text) => {
    try {
      const enc = String(encoding).toUpperCase();
      const buf =
        enc === "B" ? Buffer.from(text, "base64") : Buffer.from(text.replace(/_/g, " "), "latin1");
      return buf.toString(charset.toLowerCase() === "utf-8" ? "utf8" : "latin1");
    } catch {
      return str;
    }
  });
}

/**
 * Extract plain-text body from raw RFC 2822 message.
 * Handles text/plain directly or first text/plain part in multipart.
 */
function extractTextBody(rawSource: Buffer): string {
  const raw = rawSource.toString("utf8");
  const headerEnd = raw.indexOf("\r\n\r\n");
  if (headerEnd === -1) return raw.slice(0, 500);

  const headers = raw.slice(0, headerEnd);
  const body = raw.slice(headerEnd + 4);

  // Get Content-Type header
  const ctMatch = headers.match(/content-type:\s*([^\r\n]+(?:\r?\n\s+[^\r\n]+)*)/i);
  const contentType = ctMatch ? ctMatch[1].toLowerCase().replace(/\r?\n\s+/g, " ") : "text/plain";

  if (contentType.startsWith("text/plain")) {
    // Check for Content-Transfer-Encoding
    const cteMatch = headers.match(/content-transfer-encoding:\s*([^\r\n]+)/i);
    const cte = cteMatch ? cteMatch[1].trim().toLowerCase() : "";
    if (cte === "base64") {
      return Buffer.from(body.replace(/\r?\n/g, ""), "base64").toString("utf8").slice(0, 4000);
    }
    if (cte === "quoted-printable") {
      return body.replace(/=\r?\n/g, "").replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      ).slice(0, 4000);
    }
    return body.slice(0, 4000);
  }

  if (contentType.startsWith("multipart/")) {
    // Extract boundary
    const boundaryMatch = contentType.match(/boundary="?([^";]+)"?/i);
    if (!boundaryMatch) return body.slice(0, 500);
    const boundary = boundaryMatch[1].trim();
    const parts = body.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g"));
    for (const part of parts) {
      if (!part || part.trim() === "--") continue;
      const partHeaderEnd = part.indexOf("\r\n\r\n");
      if (partHeaderEnd === -1) continue;
      const partHeaders = part.slice(0, partHeaderEnd);
      const partBody = part.slice(partHeaderEnd + 4);
      if (/content-type:\s*text\/plain/i.test(partHeaders)) {
        return partBody.slice(0, 4000).trim();
      }
    }
  }

  return body.slice(0, 500);
}

// ---- EmailClient ----

export class EmailClient {
  private credential: EmailCredential;
  private options: EmailOptions;

  constructor(credential: EmailCredential, options: EmailOptions) {
    this.credential = credential;
    this.options = options;
  }

  /**
   * Fetch unseen emails from the configured mailbox.
   */
  async fetchUnseen(): Promise<ParsedEmail[]> {
    const cred = this.credential;
    const opts = this.options;

    const client = new ImapFlow({
      host: cred.imap_host,
      port: cred.imap_port,
      secure: cred.imap_port === 993,
      auth: { user: cred.imap_user, pass: cred.imap_pass },
      logger: false,
    });

    await client.connect();
    const lock = await client.getMailboxLock(opts.mailbox);

    try {
      const uids = await client.search({ seen: false }, { uid: true });
      if (!uids || uids.length === 0) return [];

      const results: ParsedEmail[] = [];

      for await (const msg of client.fetch(uids, {
        uid: true,
        envelope: true,
        headers: ["references", "in-reply-to"],
        source: true,
      }, { uid: true })) {
        const env = msg.envelope;
        if (!env) continue;

        const messageId = env.messageId ?? `uid-${msg.uid}@unknown`;
        const inReplyTo = env.inReplyTo ?? null;

        // Parse References from headers buffer
        let references: string[] = [];
        if (msg.headers) {
          const headersStr = msg.headers.toString("utf8");
          const refMatch = headersStr.match(/references:\s*([^\r\n]+(?:\r?\n\s+[^\r\n]+)*)/i);
          if (refMatch) {
            references = parseReferences(refMatch[1]);
          }
        }

        const fromAddr = env.from?.[0];
        const { email: fromEmail, name: fromName } = parseAddressString(fromAddr);

        const subject = decodeMimeWords(env.subject ?? "(sem assunto)");
        const bodyText = msg.source ? extractTextBody(msg.source) : "";

        results.push({
          uid: msg.uid,
          messageId,
          inReplyTo,
          references,
          from: fromEmail,
          fromName,
          subject,
          bodyText: bodyText.trim(),
          date: env.date ?? null,
        });
      }

      return results;
    } finally {
      lock.release();
      await client.logout();
    }
  }

  /**
   * Mark emails as seen by UID.
   */
  async markSeen(uids: number[]): Promise<void> {
    if (uids.length === 0) return;

    const cred = this.credential;
    const opts = this.options;

    const client = new ImapFlow({
      host: cred.imap_host,
      port: cred.imap_port,
      secure: cred.imap_port === 993,
      auth: { user: cred.imap_user, pass: cred.imap_pass },
      logger: false,
    });

    await client.connect();
    const lock = await client.getMailboxLock(opts.mailbox);
    try {
      await client.messageFlagsAdd(uids, ["\\Seen"], { uid: true });
    } finally {
      lock.release();
      await client.logout();
    }
  }

  /**
   * Send an email via SMTP.
   */
  async sendSmtp(opts: SmtpSendOptions): Promise<{ ok: boolean; messageId: string }> {
    const cred = this.credential;

    const transporter = nodemailer.createTransport({
      host: cred.smtp_host,
      port: cred.smtp_port,
      secure: cred.smtp_secure,
      auth: { user: cred.smtp_user, pass: cred.smtp_pass },
    });

    const fromField = opts.fromName
      ? `"${opts.fromName}" <${opts.from}>`
      : opts.from;

    const info = await transporter.sendMail({
      from: fromField,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      ...(opts.inReplyTo ? { inReplyTo: opts.inReplyTo } : {}),
      ...(opts.references ? { references: opts.references } : {}),
    });

    return { ok: true, messageId: info.messageId ?? "" };
  }

  /**
   * Test IMAP connectivity. Returns { ok, latencyMs, mailbox, unreadCount }.
   */
  async testImap(): Promise<{ ok: boolean; latencyMs: number; mailbox: string; unreadCount: number; error?: string }> {
    const start = Date.now();
    const cred = this.credential;
    const opts = this.options;

    const client = new ImapFlow({
      host: cred.imap_host,
      port: cred.imap_port,
      secure: cred.imap_port === 993,
      auth: { user: cred.imap_user, pass: cred.imap_pass },
      logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock(opts.mailbox);
      const mailboxInfo = client.mailbox;
      const mailboxPath = mailboxInfo ? mailboxInfo.path : opts.mailbox;
      let unreadCount = 0;
      try {
        const uids = await client.search({ seen: false }, { uid: true });
        unreadCount = uids ? uids.length : 0;
      } finally {
        lock.release();
      }
      await client.logout();
      return {
        ok: true,
        latencyMs: Date.now() - start,
        mailbox: mailboxPath,
        unreadCount,
      };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        mailbox: opts.mailbox,
        unreadCount: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Test SMTP connectivity.
   */
  async testSmtp(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    const cred = this.credential;

    const transporter = nodemailer.createTransport({
      host: cred.smtp_host,
      port: cred.smtp_port,
      secure: cred.smtp_secure,
      auth: { user: cred.smtp_user, pass: cred.smtp_pass },
    });

    try {
      await transporter.verify();
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

export function createEmailClient(credential: EmailCredential, options: EmailOptions): EmailClient {
  return new EmailClient(credential, options);
}
