import { deliverToChannel } from "../system-channel.js";
import type { SDKMessage, SDKAssistantMessage } from "../../agent/index.js";

interface StreamDispatcherOptions {
  channelId: string;
  agentId: string;
  recipientId: string;
  adapterSlug: string;
  metadata?: Record<string, unknown>;
}

/**
 * Wraps an SDKMessage async generator and dispatches text to the channel
 * at each SDKAssistantMessage boundary (and on final result).
 *
 * Each SDKAssistantMessage contains the complete text of a turn — no
 * accumulation needed. We extract text blocks and deliver immediately.
 *
 * Ignores: stream_event (deltas), user (tool results), tool_progress,
 * presence, system. Only reacts to assistant and result.
 *
 * See milestone 25, RISKS.md#R-01 for full rationale.
 */
export async function* createStreamDispatcher(
  messages: AsyncGenerator<SDKMessage>,
  options: StreamDispatcherOptions
): AsyncGenerator<SDKMessage> {
  for await (const msg of messages) {
    if (msg.type === "assistant") {
      const assistantMsg = msg as SDKAssistantMessage;
      const text = assistantMsg.message.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("");

      let cleaned = text.trim();

      // Strip channel prefix if the model echoed it back
      const prefixPattern = new RegExp(
        `^\\[canal:\\s*${options.adapterSlug}\\]\\s*`
      );
      cleaned = cleaned.replace(prefixPattern, "").trim();

      if (cleaned) {
        await deliverToChannel(options.channelId, options.agentId, cleaned, {
          metadata: {
            recipientId: options.recipientId,
            ...options.metadata,
          },
        });
      }
    }

    yield msg;
  }
}
