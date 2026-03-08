import { getChannel } from "../registry.js";
import { findOrCreateSession, sendMessage } from "../../conversations/index.js";
import { createStreamDispatcher } from "./stream-dispatcher.js";
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

export async function routeInboundMessage(
  channelId: string,
  message: InboundMessage,
  onComplete?: (sessionId: string, agentId: string) => Promise<void>
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
  const adapterSlug = (channel.metadata["channel-adapter"] as string) ?? channelId;

  const prefixedContent = `[canal: ${adapterSlug}] ${content}`;

  console.log(`[inbound-router] processing: agent=${agentId} session=${sessionId} content="${content.substring(0, 50)}"`);

  try {
    const events = sendMessage(message.senderId, sessionId, prefixedContent);
    const dispatcher = createStreamDispatcher(events, {
      channelId,
      agentId,
      recipientId: message.senderId,
      adapterSlug,
      metadata: message.metadata,
    });
    for await (const _event of dispatcher) {
      // consumed by dispatcher — delivery happens at each step_finish
    }
    if (onComplete) {
      await onComplete(sessionId, agentId);
    }
  } catch (err) {
    console.error(`[inbound-router] ERROR in sendMessage:`, err);
  }
}
