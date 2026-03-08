import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { credentialSchema, optionsSchema } from "./schemas.js";
import { EmailClient } from "./client.js";
import type { ParsedEmail } from "./client.js";

// ---- State persistence ----

interface EmailPollingState {
  adapterId: string;
  processedMessageIds: string[];
  /** messageId → backbone session_id */
  threadMap: Record<string, string>;
  lastPollAt: string | null;
  processedToday: number;
  lastDayReset: string | null;
  lastError: string | null;
}

const DATA_DIR = join(process.cwd(), "data", "email-state");

function stateFilePath(adapterId: string): string {
  return join(DATA_DIR, `${adapterId}.json`);
}

function loadState(adapterId: string): EmailPollingState {
  mkdirSync(DATA_DIR, { recursive: true });
  const path = stateFilePath(adapterId);
  if (existsSync(path)) {
    try {
      return JSON.parse(readFileSync(path, "utf8")) as EmailPollingState;
    } catch {
      // corrupt file — start fresh
    }
  }
  return {
    adapterId,
    processedMessageIds: [],
    threadMap: {},
    lastPollAt: null,
    processedToday: 0,
    lastDayReset: null,
    lastError: null,
  };
}

function saveState(state: EmailPollingState): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(stateFilePath(state.adapterId), JSON.stringify(state, null, 2), "utf8");
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function incrementProcessedToday(state: EmailPollingState): void {
  const today = todayKey();
  if (state.lastDayReset !== today) {
    state.processedToday = 0;
    state.lastDayReset = today;
  }
  state.processedToday += 1;
}

// ---- Per-adapter polling state ----

const activeTimers = new Map<string, ReturnType<typeof setInterval>>();

// ---- Exported state accessor (for status API) ----

export const pollingStatus = new Map<
  string,
  { polling: boolean; lastPollAt: string | null; processedToday: number; lastError: string | null }
>();

// ---- Process a single email ----

async function processEmail(
  email: ParsedEmail,
  adapterId: string,
  agentId: string,
  state: EmailPollingState,
  client: EmailClient,
  autoReply: boolean,
  replyPrefix: string,
  fromName: string,
  senderEmail: string
): Promise<void> {
  // Import lazily to avoid circular deps at module load time
  const { findOrCreateSession, sendMessage } = await import("../../conversations/index.js");
  const { eventBus } = await import("../../events/index.js");

  // Determine session: follow thread via In-Reply-To / References
  const threadKey =
    (email.inReplyTo && state.threadMap[email.inReplyTo]) ??
    email.references.reduce<string | undefined>(
      (found, ref) => found ?? state.threadMap[ref],
      undefined
    );

  const channelId = `email:${adapterId}`;
  const session = threadKey
    ? await (async () => {
        const { getSession } = await import("../../conversations/index.js");
        return getSession(threadKey);
      })()
    : null;

  const activeSession =
    session ?? findOrCreateSession(agentId, email.from, channelId);

  // Map this message's ID → session for future thread continuation
  state.threadMap[email.messageId] = activeSession.session_id;

  // Build XML prompt
  const prompt = buildEmailPrompt(email);

  // Emit channel:message event
  eventBus.emit("channel:message", {
    ts: Date.now(),
    channelId: `email:${adapterId}`,
    agentId,
    role: "user" as const,
    content: `[email from ${email.from}] ${email.subject}`,
    sessionId: activeSession.session_id,
  });

  // Run agent via conversation sendMessage
  let agentReply = "";
  try {
    for await (const event of sendMessage(email.from, activeSession.session_id, prompt)) {
      if (event.type === "text" && event.content) agentReply += event.content;
      if (event.type === "result" && event.content) agentReply = event.content;
    }
  } catch (err) {
    console.error(`[email-adapter:${adapterId}] sendMessage error:`, err);
    state.lastError = err instanceof Error ? err.message : String(err);
    return;
  }

  // Send SMTP reply if enabled
  if (autoReply && agentReply.trim()) {
    const prefixedReply = replyPrefix ? `${replyPrefix}${agentReply.trim()}` : agentReply.trim();

    // Build References header for correct threading
    const refParts = [...email.references];
    if (email.inReplyTo && !refParts.includes(email.inReplyTo)) {
      refParts.push(email.inReplyTo);
    }
    if (!refParts.includes(email.messageId)) {
      refParts.push(email.messageId);
    }

    try {
      await client.sendSmtp({
        from: senderEmail,
        fromName,
        to: email.from,
        subject: email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`,
        text: prefixedReply,
        inReplyTo: email.messageId,
        references: refParts.join(" "),
      });
    } catch (err) {
      console.error(`[email-adapter:${adapterId}] SMTP send error:`, err);
      state.lastError = err instanceof Error ? err.message : String(err);
    }
  }
}

// ---- Build XML prompt ----

function buildEmailPrompt(email: ParsedEmail): string {
  const fromTag = email.fromName
    ? `${email.fromName} &lt;${email.from}&gt;`
    : email.from;

  return `<email_received>
  <from>${fromTag}</from>
  <subject>${escapeXml(email.subject)}</subject>
  <message_id>${escapeXml(email.messageId)}</message_id>
  <date>${email.date ? email.date.toISOString() : ""}</date>
  <body>${escapeXml(email.bodyText)}</body>
</email_received>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ---- Poll cycle ----

async function pollAdapter(adapterId: string): Promise<void> {
  const { connectorRegistry } = await import("../index.js");

  const adapter = connectorRegistry.findAdapter(adapterId);
  if (!adapter) {
    console.warn(`[email-adapter] adapter "${adapterId}" not found during poll`);
    return;
  }

  const credResult = credentialSchema.safeParse(adapter.credential);
  const optsResult = optionsSchema.safeParse(adapter.options);

  if (!credResult.success || !optsResult.success) {
    console.error(`[email-adapter:${adapterId}] invalid credential/options`);
    return;
  }

  const cred = credResult.data;
  const opts = optsResult.data;
  const state = loadState(adapterId);

  const statusEntry = pollingStatus.get(adapterId) ?? {
    polling: true,
    lastPollAt: null,
    processedToday: state.processedToday,
    lastError: null,
  };
  statusEntry.polling = true;
  pollingStatus.set(adapterId, statusEntry);

  const client = new EmailClient(cred, opts);

  let unseenEmails: ParsedEmail[] = [];
  try {
    unseenEmails = await client.fetchUnseen();
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[email-adapter:${adapterId}] IMAP fetch error: ${errMsg}`);
    state.lastError = errMsg;
    state.lastPollAt = new Date().toISOString();
    saveState(state);
    statusEntry.lastError = errMsg;
    statusEntry.lastPollAt = state.lastPollAt;
    pollingStatus.set(adapterId, statusEntry);
    return;
  }

  const newEmails = unseenEmails.filter(
    (e) => !state.processedMessageIds.includes(e.messageId)
  );

  if (newEmails.length === 0) {
    state.lastPollAt = new Date().toISOString();
    saveState(state);
    statusEntry.lastPollAt = state.lastPollAt;
    pollingStatus.set(adapterId, statusEntry);
    return;
  }

  const toMarkSeen: number[] = [];

  for (const email of newEmails) {
    // sender_whitelist filter
    if (opts.sender_whitelist.length > 0) {
      const allowed = opts.sender_whitelist.some(
        (w) => w.toLowerCase() === email.from.toLowerCase()
      );
      if (!allowed) {
        console.log(
          `[email-adapter:${adapterId}] skipping email from ${email.from} (not in whitelist)`
        );
        // Still mark as processed to avoid re-checking
        state.processedMessageIds.push(email.messageId);
        if (opts.mark_seen) toMarkSeen.push(email.uid);
        continue;
      }
    }

    // subject_filter
    if (opts.subject_filter) {
      try {
        const regex = new RegExp(opts.subject_filter, "i");
        if (!regex.test(email.subject)) {
          console.log(
            `[email-adapter:${adapterId}] skipping email "${email.subject}" (subject_filter)`
          );
          state.processedMessageIds.push(email.messageId);
          continue;
        }
      } catch {
        // invalid regex — skip filter
      }
    }

    try {
      await processEmail(
        email,
        adapterId,
        opts.agent_id,
        state,
        client,
        opts.auto_reply,
        opts.reply_prefix,
        opts.from_name || cred.smtp_user,
        cred.smtp_user
      );
    } catch (err) {
      console.error(`[email-adapter:${adapterId}] error processing email ${email.messageId}:`, err);
      state.lastError = err instanceof Error ? err.message : String(err);
    }

    state.processedMessageIds.push(email.messageId);
    incrementProcessedToday(state);

    if (opts.mark_seen) {
      toMarkSeen.push(email.uid);
    }
  }

  // Mark emails as seen in IMAP
  if (toMarkSeen.length > 0) {
    try {
      await client.markSeen(toMarkSeen);
    } catch (err) {
      console.error(`[email-adapter:${adapterId}] markSeen error:`, err);
    }
  }

  // Trim processedMessageIds to last 10k to avoid unbounded growth
  if (state.processedMessageIds.length > 10_000) {
    state.processedMessageIds = state.processedMessageIds.slice(-10_000);
  }

  state.lastPollAt = new Date().toISOString();
  state.lastError = null;
  saveState(state);

  statusEntry.lastPollAt = state.lastPollAt;
  statusEntry.processedToday = state.processedToday;
  statusEntry.lastError = null;
  pollingStatus.set(adapterId, statusEntry);
}

// ---- Start / stop per adapter ----

export function startEmailPolling(adapterId: string, intervalSeconds: number): void {
  if (activeTimers.has(adapterId)) return; // already running

  pollingStatus.set(adapterId, {
    polling: true,
    lastPollAt: null,
    processedToday: loadState(adapterId).processedToday,
    lastError: null,
  });

  // Run immediately on start
  pollAdapter(adapterId).catch((err) => {
    console.error(`[email-adapter:${adapterId}] initial poll error:`, err);
  });

  const timer = setInterval(() => {
    pollAdapter(adapterId).catch((err) => {
      console.error(`[email-adapter:${adapterId}] poll error:`, err);
    });
  }, intervalSeconds * 1000);

  activeTimers.set(adapterId, timer);
  console.log(`[email-adapter] started polling for "${adapterId}" every ${intervalSeconds}s`);
}

export function stopEmailPolling(adapterId: string): void {
  const timer = activeTimers.get(adapterId);
  if (timer) {
    clearInterval(timer);
    activeTimers.delete(adapterId);
  }
  const status = pollingStatus.get(adapterId);
  if (status) {
    status.polling = false;
    pollingStatus.set(adapterId, status);
  }
}

export function stopAllEmailPolling(): void {
  for (const adapterId of [...activeTimers.keys()]) {
    stopEmailPolling(adapterId);
  }
}
