import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import type { EmailCredential, EmailOptions } from "./schemas.js";

// ---- Types ----

export interface AttachmentMeta {
  partId: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface ParsedEmail {
  uid: number;
  messageId: string;
  inReplyTo: string | null;
  references: string[];
  from: string;
  fromName: string;
  to: string[];
  cc: string[];
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  date: Date | null;
  attachments: AttachmentMeta[];
}

export interface SmtpSendOptions {
  from: string;
  fromName: string;
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    encoding: "base64";
  }>;
}

export interface ImapSearchCriteria {
  from?: string;
  to?: string;
  subject?: string;
  body?: string;
  since?: Date;
  before?: Date;
  seen?: boolean;
  flagged?: boolean;
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

function parseAddressList(
  addrs: Array<{ name?: string; address?: string }> | undefined
): string[] {
  if (!addrs) return [];
  return addrs.map((a) => a.address ?? "").filter(Boolean);
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
 * Parse MIME message parts, extracting text/plain, text/html, and attachment metadata.
 */
function parseMessageParts(rawSource: Buffer): {
  text: string;
  html: string | null;
  attachments: AttachmentMeta[];
} {
  const raw = rawSource.toString("utf8");
  const headerEnd = raw.indexOf("\r\n\r\n");
  if (headerEnd === -1) return { text: raw.slice(0, 500), html: null, attachments: [] };

  const headers = raw.slice(0, headerEnd);
  const body = raw.slice(headerEnd + 4);

  const ctMatch = headers.match(/content-type:\s*([^\r\n]+(?:\r?\n\s+[^\r\n]+)*)/i);
  const contentType = ctMatch ? ctMatch[1].toLowerCase().replace(/\r?\n\s+/g, " ") : "text/plain";

  if (contentType.startsWith("text/plain")) {
    return { text: decodeBody(body, headers).slice(0, 4000), html: null, attachments: [] };
  }

  if (contentType.startsWith("text/html")) {
    return { text: "", html: decodeBody(body, headers).slice(0, 4000), attachments: [] };
  }

  if (contentType.startsWith("multipart/")) {
    return parseMultipart(body, contentType);
  }

  return { text: body.slice(0, 500), html: null, attachments: [] };
}

function decodeBody(body: string, headers: string): string {
  const cteMatch = headers.match(/content-transfer-encoding:\s*([^\r\n]+)/i);
  const cte = cteMatch ? cteMatch[1].trim().toLowerCase() : "";
  if (cte === "base64") {
    return Buffer.from(body.replace(/\r?\n/g, ""), "base64").toString("utf8");
  }
  if (cte === "quoted-printable") {
    return body
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }
  return body;
}

function parseMultipart(
  body: string,
  contentType: string
): { text: string; html: string | null; attachments: AttachmentMeta[] } {
  const boundaryMatch = contentType.match(/boundary="?([^";]+)"?/i);
  if (!boundaryMatch) return { text: body.slice(0, 500), html: null, attachments: [] };

  const boundary = boundaryMatch[1].trim();
  const parts = body.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g"));

  let text = "";
  let html: string | null = null;
  const attachments: AttachmentMeta[] = [];
  let partIndex = 0;

  for (const part of parts) {
    if (!part || part.trim() === "--" || part.trim() === "") continue;
    const partHeaderEnd = part.indexOf("\r\n\r\n");
    if (partHeaderEnd === -1) continue;
    const partHeaders = part.slice(0, partHeaderEnd);
    const partBody = part.slice(partHeaderEnd + 4);

    const partCtMatch = partHeaders.match(/content-type:\s*([^\r\n]+(?:\r?\n\s+[^\r\n]+)*)/i);
    const partCt = partCtMatch ? partCtMatch[1].toLowerCase().replace(/\r?\n\s+/g, " ") : "";
    const disposition = partHeaders.match(/content-disposition:\s*([^\r\n]+(?:\r?\n\s+[^\r\n]+)*)/i);
    const dispValue = disposition ? disposition[1].toLowerCase().replace(/\r?\n\s+/g, " ") : "";

    // Nested multipart
    if (partCt.startsWith("multipart/")) {
      const nested = parseMultipart(partBody, partCt);
      if (!text && nested.text) text = nested.text;
      if (!html && nested.html) html = nested.html;
      attachments.push(...nested.attachments);
      continue;
    }

    // Attachment detection
    if (dispValue.startsWith("attachment") || (partCt && !partCt.startsWith("text/"))) {
      const fnMatch =
        dispValue.match(/filename="?([^";]+)"?/i) ?? partCt.match(/name="?([^";]+)"?/i);
      const filename = fnMatch ? fnMatch[1].trim() : `part-${partIndex}`;
      const sizeMatch = partHeaders.match(/content-length:\s*(\d+)/i);
      const size = sizeMatch ? parseInt(sizeMatch[1], 10) : partBody.length;

      attachments.push({
        partId: String(partIndex),
        filename,
        contentType: partCt.split(";")[0].trim() || "application/octet-stream",
        size,
      });
      partIndex++;
      continue;
    }

    if (partCt.startsWith("text/plain") && !text) {
      text = decodeBody(partBody, partHeaders).slice(0, 4000).trim();
    } else if (partCt.startsWith("text/html") && !html) {
      html = decodeBody(partBody, partHeaders).slice(0, 4000).trim();
    }
    partIndex++;
  }

  return { text, html, attachments };
}

/**
 * Extract attachment metadata from bodyStructure tree (ImapFlow format).
 */
function extractAttachmentsFromStructure(
  structure: any,
  parentPartId = ""
): AttachmentMeta[] {
  if (!structure) return [];
  const attachments: AttachmentMeta[] = [];

  if (structure.childNodes && Array.isArray(structure.childNodes)) {
    for (let i = 0; i < structure.childNodes.length; i++) {
      const childPartId = parentPartId ? `${parentPartId}.${i + 1}` : String(i + 1);
      attachments.push(...extractAttachmentsFromStructure(structure.childNodes[i], childPartId));
    }
    return attachments;
  }

  const type = `${structure.type ?? ""}/${structure.subtype ?? ""}`.toLowerCase();
  const disposition = (structure.disposition ?? "").toLowerCase();
  const partId = parentPartId || "1";

  if (disposition === "attachment" || (type !== "text/plain" && type !== "text/html" && !type.startsWith("multipart/"))) {
    const filename =
      structure.dispositionParameters?.filename ??
      structure.parameters?.name ??
      `part-${partId}`;
    attachments.push({
      partId,
      filename,
      contentType: type,
      size: structure.size ?? 0,
    });
  }

  return attachments;
}

// ---- EmailClient ----

export class EmailClient {
  private credential: EmailCredential;
  private options: EmailOptions;

  constructor(credential: EmailCredential, options: EmailOptions) {
    this.credential = credential;
    this.options = options;
  }

  private createImapClient(): ImapFlow {
    return new ImapFlow({
      host: this.credential.imap_host,
      port: this.credential.imap_port,
      secure: this.credential.imap_port === 993,
      auth: { user: this.credential.imap_user, pass: this.credential.imap_pass },
      logger: false,
    });
  }

  private async withMailbox<T>(mailbox: string, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
    const client = this.createImapClient();
    await client.connect();
    const lock = await client.getMailboxLock(mailbox);
    try {
      return await fn(client);
    } finally {
      lock.release();
      await client.logout();
    }
  }

  private async withClient<T>(fn: (client: ImapFlow) => Promise<T>): Promise<T> {
    const client = this.createImapClient();
    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.logout();
    }
  }

  private parseFetchedMessage(msg: any): ParsedEmail {
    const env = msg.envelope;
    const messageId = env?.messageId ?? `uid-${msg.uid}@unknown`;
    const inReplyTo = env?.inReplyTo ?? null;

    let references: string[] = [];
    if (msg.headers) {
      const headersStr = msg.headers.toString("utf8");
      const refMatch = headersStr.match(/references:\s*([^\r\n]+(?:\r?\n\s+[^\r\n]+)*)/i);
      if (refMatch) {
        references = parseReferences(refMatch[1]);
      }
    }

    const fromAddr = env?.from?.[0];
    const { email: fromEmail, name: fromName } = parseAddressString(fromAddr);
    const to = parseAddressList(env?.to);
    const cc = parseAddressList(env?.cc);
    const subject = decodeMimeWords(env?.subject ?? "(sem assunto)");

    let bodyText = "";
    let bodyHtml: string | null = null;
    let attachments: AttachmentMeta[] = [];

    if (msg.source) {
      const parsed = parseMessageParts(msg.source);
      bodyText = parsed.text;
      bodyHtml = parsed.html;
      attachments = parsed.attachments;
    }

    // Also try bodyStructure for more accurate attachment info
    if (msg.bodyStructure) {
      const structAttachments = extractAttachmentsFromStructure(msg.bodyStructure);
      if (structAttachments.length > 0) {
        attachments = structAttachments;
      }
    }

    return {
      uid: msg.uid,
      messageId,
      inReplyTo,
      references,
      from: fromEmail,
      fromName,
      to,
      cc,
      subject,
      bodyText: bodyText.trim(),
      bodyHtml,
      date: env?.date ?? null,
      attachments,
    };
  }

  /**
   * Fetch unseen emails from the configured mailbox.
   */
  async fetchUnseen(): Promise<ParsedEmail[]> {
    return this.withMailbox(this.options.mailbox, async (client) => {
      const uids = await client.search({ seen: false }, { uid: true });
      if (!uids || uids.length === 0) return [];

      const results: ParsedEmail[] = [];

      for await (const msg of client.fetch(uids, {
        uid: true,
        envelope: true,
        headers: ["references", "in-reply-to"],
        source: true,
        bodyStructure: true,
      }, { uid: true })) {
        if (!msg.envelope) continue;
        results.push(this.parseFetchedMessage(msg));
      }

      return results;
    });
  }

  /**
   * Mark emails as seen by UID.
   */
  async markSeen(uids: number[]): Promise<void> {
    if (uids.length === 0) return;
    await this.withMailbox(this.options.mailbox, async (client) => {
      await client.messageFlagsAdd(uids, ["\\Seen"], { uid: true });
    });
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
      html: opts.html,
      cc: opts.cc,
      bcc: opts.bcc,
      replyTo: opts.replyTo,
      attachments: opts.attachments,
      ...(opts.inReplyTo ? { inReplyTo: opts.inReplyTo } : {}),
      ...(opts.references ? { references: opts.references } : {}),
    });

    return { ok: true, messageId: info.messageId ?? "" };
  }

  /**
   * Search messages in a mailbox with various criteria.
   */
  async searchMessages(
    mailbox: string,
    criteria: ImapSearchCriteria,
    limit = 20
  ): Promise<ParsedEmail[]> {
    return this.withMailbox(mailbox, async (client) => {
      const searchQuery: any = {};
      if (criteria.from) searchQuery.from = criteria.from;
      if (criteria.to) searchQuery.to = criteria.to;
      if (criteria.subject) searchQuery.subject = criteria.subject;
      if (criteria.body) searchQuery.body = criteria.body;
      if (criteria.since) searchQuery.since = criteria.since;
      if (criteria.before) searchQuery.before = criteria.before;
      if (criteria.seen !== undefined) searchQuery.seen = criteria.seen;
      if (criteria.flagged !== undefined) searchQuery.flagged = criteria.flagged;

      // ImapFlow requires at least one criterion; use 'all' when no filters
      if (Object.keys(searchQuery).length === 0) searchQuery.all = true;

      const uids = await client.search(searchQuery, { uid: true });
      if (!uids || uids.length === 0) return [];

      // Take most recent (last N UIDs, since IMAP UIDs are ascending)
      const limitedUids = uids.slice(-limit);

      const results: ParsedEmail[] = [];
      for await (const msg of client.fetch(limitedUids, {
        uid: true,
        envelope: true,
        headers: ["references", "in-reply-to"],
        source: true,
        bodyStructure: true,
      }, { uid: true })) {
        if (!msg.envelope) continue;
        const parsed = this.parseFetchedMessage(msg);
        // Truncate body for search results
        parsed.bodyText = parsed.bodyText.slice(0, 500);
        if (parsed.bodyHtml) parsed.bodyHtml = parsed.bodyHtml.slice(0, 500);
        results.push(parsed);
      }

      return results;
    });
  }

  /**
   * Fetch a single message by UID with full body.
   */
  async fetchByUid(mailbox: string, uid: number): Promise<ParsedEmail | null> {
    return this.withMailbox(mailbox, async (client) => {
      let result: ParsedEmail | null = null;
      for await (const msg of client.fetch([uid], {
        uid: true,
        envelope: true,
        headers: ["references", "in-reply-to"],
        source: true,
        bodyStructure: true,
      }, { uid: true })) {
        if (!msg.envelope) continue;
        result = this.parseFetchedMessage(msg);
      }
      return result;
    });
  }

  /**
   * Download an attachment by UID and part ID.
   * Returns base64 content. Cap at 5MB.
   */
  async downloadAttachment(
    mailbox: string,
    uid: number,
    partId: string
  ): Promise<{ filename: string; contentType: string; content: string }> {
    return this.withMailbox(mailbox, async (client) => {
      const download = await client.download(String(uid), partId, { uid: true });
      const chunks: Buffer[] = [];
      let totalSize = 0;
      const MAX_SIZE = 5 * 1024 * 1024;

      for await (const chunk of download.content) {
        totalSize += chunk.length;
        if (totalSize > MAX_SIZE) {
          throw new Error(`Attachment exceeds 5MB limit (${totalSize} bytes)`);
        }
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const buffer = Buffer.concat(chunks);
      return {
        filename: download.meta?.filename ?? `attachment-${partId}`,
        contentType: download.meta?.contentType ?? "application/octet-stream",
        content: buffer.toString("base64"),
      };
    });
  }

  /**
   * Add or remove IMAP flags on messages.
   */
  async setFlags(
    mailbox: string,
    uids: number[],
    flags: string[],
    action: "add" | "remove"
  ): Promise<void> {
    await this.withMailbox(mailbox, async (client) => {
      if (action === "add") {
        await client.messageFlagsAdd(uids, flags, { uid: true });
      } else {
        await client.messageFlagsRemove(uids, flags, { uid: true });
      }
    });
  }

  /**
   * Move messages to another mailbox.
   */
  async moveMessages(sourceMailbox: string, uids: number[], destMailbox: string): Promise<void> {
    await this.withMailbox(sourceMailbox, async (client) => {
      await client.messageMove(uids, destMailbox, { uid: true });
    });
  }

  /**
   * Delete messages permanently (flag \Deleted + EXPUNGE).
   */
  async deleteMessages(mailbox: string, uids: number[]): Promise<void> {
    await this.withMailbox(mailbox, async (client) => {
      await client.messageFlagsAdd(uids, ["\\Deleted"], { uid: true });
      // expunge may not be in type defs but is available at runtime
      if (typeof (client as any).expunge === "function") {
        await (client as any).expunge();
      }
    });
  }

  /**
   * List all mailboxes/folders in the account.
   */
  async listMailboxes(): Promise<Array<{ path: string; name: string; specialUse?: string; delimiter: string }>> {
    return this.withClient(async (client) => {
      const list = await client.list();
      return list.map((mb: any) => ({
        path: mb.path,
        name: mb.name,
        specialUse: mb.specialUse ?? undefined,
        delimiter: mb.delimiter ?? "/",
      }));
    });
  }

  /**
   * Generic ping used by testAdapter in registry — delegates to testImap.
   */
  async ping(): Promise<{ ok: boolean; error?: string }> {
    const result = await this.testImap();
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }

  /**
   * Test IMAP connectivity. Returns { ok, latencyMs, mailbox, unreadCount }.
   */
  async testImap(): Promise<{ ok: boolean; latencyMs: number; mailbox: string; unreadCount: number; error?: string }> {
    const start = Date.now();
    try {
      return await this.withMailbox(this.options.mailbox, async (client) => {
        const mailboxInfo = client.mailbox;
        const mailboxPath = mailboxInfo ? mailboxInfo.path : this.options.mailbox;
        const uids = await client.search({ seen: false }, { uid: true });
        const unreadCount = uids ? uids.length : 0;
        return {
          ok: true,
          latencyMs: Date.now() - start,
          mailbox: mailboxPath,
          unreadCount,
        };
      });
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        mailbox: this.options.mailbox,
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
