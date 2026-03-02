import { getChannel } from "../channels/registry.js";
import { findOrCreateSession, sendMessage } from "../conversations/index.js";
import { deliverToChannel } from "../channels/system-channel.js";
import {
  isProcessing,
  markProcessing,
  markIdle,
  enqueue,
  drain,
  didSendViaTool,
  clearSendTracking,
} from "../conversations/message-queue.js";
import type { InboundMessage } from "./types.js";

const MAX_CONTENT_LENGTH = 4000;

function sanitizeContent(raw: string): string {
  let text = raw.slice(0, MAX_CONTENT_LENGTH);
  // Strip control chars (except newline, tab)
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  // Strip zero-width chars
  text = text.replace(/[\u200B-\u200D\uFEFF\u2060]/g, "");
  return text.trim();
}

/**
 * Processes a single message through the agent and delivers the response.
 * Returns void — delivery is handled internally.
 */
async function processMessage(
  channelId: string,
  agentId: string,
  sessionId: string,
  senderId: string,
  content: string,
  adapterSlug: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const prefixedContent = `[canal: ${adapterSlug}] ${content}`;

  clearSendTracking(sessionId);

  let fullText = "";
  for await (const event of sendMessage(senderId, sessionId, prefixedContent)) {
    if (event.type === "result" && event.content) {
      fullText = event.content;
    } else if (event.type === "text" && event.content) {
      fullText += event.content;
    }
  }

  // If the agent communicated via send_message tool, skip the final delivery.
  if (didSendViaTool(sessionId)) {
    console.log(`[inbound-router] agent used send_message — skipping final delivery`);
    return;
  }

  // Strip channel prefix if the model echoed it back
  const prefixPattern = new RegExp(`^\\[canal:\\s*${adapterSlug}\\]\\s*`);
  fullText = fullText.replace(prefixPattern, "").trim();

  if (fullText) {
    await deliverToChannel(channelId, agentId, fullText, {
      metadata: {
        recipientId: senderId,
        ...metadata,
      },
    });
  }
}

export async function routeInboundMessage(
  channelId: string,
  message: InboundMessage
): Promise<void> {
  const channel = getChannel(channelId);
  if (!channel) {
    console.warn(`[inbound-router] channel not found: ${channelId}`);
    return;
  }

  const rawAllowed = channel.metadata["allowed-senders"];
  if (rawAllowed) {
    const allowedSenders = Array.isArray(rawAllowed)
      ? rawAllowed.map(String)
      : String(rawAllowed).split(",").map((s) => s.trim());
    if (!allowedSenders.includes(message.senderId)) {
      console.log(`[inbound-router] sender ${message.senderId} not in allowed-senders for "${channelId}"`);
      return;
    }
  }

  const agentId = channel.metadata.agent as string | undefined;
  if (!agentId) {
    console.warn(
      `[inbound-router] channel "${channelId}" has no agent configured`
    );
    return;
  }

  const content = sanitizeContent(message.content);
  if (!content) {
    console.warn(`[inbound-router] empty message from ${message.senderId}`);
    return;
  }

  const session = findOrCreateSession(agentId, message.senderId, channelId);
  const sessionId = session.session_id;

  // If agent is already processing this session, enqueue the message
  if (isProcessing(sessionId)) {
    enqueue(sessionId, content);
    console.log(`[inbound-router] queued message for busy session ${sessionId}`);
    return;
  }

  const adapterSlug = (channel.metadata["channel-adapter"] as string) ?? channelId;

  markProcessing(sessionId);

  try {
    // Process the initial message
    await processMessage(
      channelId, agentId, sessionId,
      message.senderId, content, adapterSlug, message.metadata
    );

    // Drain queued messages that arrived while processing
    let queued = drain(sessionId);
    while (queued.length > 0) {
      const combined = queued.join("\n");
      console.log(`[inbound-router] processing ${queued.length} queued message(s) for session ${sessionId}`);
      await processMessage(
        channelId, agentId, sessionId,
        message.senderId, combined, adapterSlug, message.metadata
      );
      queued = drain(sessionId);
    }
  } finally {
    clearSendTracking(sessionId);
    markIdle(sessionId);
  }
}
