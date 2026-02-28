import { getChannel } from "../channels/registry.js";
import { findOrCreateSession, sendMessage } from "../conversations/index.js";
import { deliverToChannel } from "../channels/system-channel.js";
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
  message: InboundMessage
): Promise<void> {
  const channel = getChannel(channelId);
  if (!channel) {
    console.warn(`[inbound-router] channel not found: ${channelId}`);
    return;
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

  // Consume sendMessage() completely (no streaming for external channels)
  let fullText = "";
  for await (const event of sendMessage(
    message.senderId,
    session.session_id,
    content
  )) {
    if (event.type === "result" && event.content) {
      fullText = event.content;
    } else if (event.type === "text" && event.content) {
      fullText += event.content;
    }
  }

  if (fullText) {
    await deliverToChannel(channelId, agentId, fullText);
  }
}
