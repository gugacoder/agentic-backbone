import { getChannel } from "../registry.js";
import { findOrCreateSession, sendMessage } from "../../conversations/index.js";
import { createStreamDispatcher } from "./stream-dispatcher.js";
import { eventBus } from "../../events/index.js";
import type { InboundMessage } from "./types.js";
import type { ContentPart } from "../../conversations/attachments.js";

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

  const rawAllowed = channel.options["allowed-senders"];
  if (rawAllowed) {
    const allowedSenders = Array.isArray(rawAllowed)
      ? rawAllowed.map(String)
      : String(rawAllowed).split(",").map((s) => s.trim());
    if (!allowedSenders.includes(message.senderId)) {
      console.log(`[inbound-router] sender ${message.senderId} not in allowed-senders for "${channelId}"`);
      return;
    }
  }

  const agentId = channel.agent;
  if (!agentId) {
    console.warn(
      `[inbound-router] channel "${channelId}" has no agent configured`
    );
    return;
  }

  const session = findOrCreateSession(agentId, message.senderId, channelId);
  const sessionId = session.session_id;
  const adapterSlug = channel["channel-adapter"] ?? channelId;

  let routedContent: string | ContentPart[];
  let previewText: string;

  if (Array.isArray(message.content)) {
    if (message.content.length === 0) {
      console.warn(`[inbound-router] empty content array from ${message.senderId}`);
      return;
    }
    // Prepend channel prefix as a TextPart; preserve rest of parts unchanged
    const prefix: ContentPart = { type: "text", text: `[canal: ${adapterSlug}]` };
    routedContent = [prefix, ...message.content] as ContentPart[];
    const firstText = message.content.find((p) => p.type === "text");
    previewText = firstText ? (firstText as { type: "text"; text: string }).text.substring(0, 50) : `[${message.content.length} parts]`;
  } else {
    const content = sanitizeContent(message.content);
    if (!content) {
      console.warn(`[inbound-router] empty message from ${message.senderId}`);
      return;
    }
    routedContent = `[canal: ${adapterSlug}] ${content}`;
    previewText = content.substring(0, 50);
  }

  console.log(`[inbound-router] processing: agent=${agentId} session=${sessionId} content="${previewText}"`);

  eventBus.emit("channel:message", {
    ts: message.ts ?? Date.now(),
    channelId,
    agentId,
    role: "user",
    content: Array.isArray(message.content)
      ? (message.content.find((p) => p.type === "text") as { type: "text"; text: string } | undefined)?.text ?? ""
      : message.content,
    sessionId,
  });

  try {
    const events = sendMessage(message.senderId, sessionId, routedContent);
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
