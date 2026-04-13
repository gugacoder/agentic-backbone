import { deliverToChannel } from "../system-channel.js";
import type { AgentEvent } from "../../agent/types.js";

interface StreamDispatcherOptions {
  channelId: string;
  agentId: string;
  recipientId: string;
  adapterSlug: string;
  metadata?: Record<string, unknown>;
}

/**
 * Wraps an AgentEvent async generator and dispatches accumulated text
 * to the channel at each assistant-complete boundary (and on final result).
 *
 * This gives channel users (e.g. WhatsApp) intermediate messages
 * instead of waiting for the full response.
 */
export async function* createStreamDispatcher(
  events: AsyncGenerator<AgentEvent>,
  options: StreamDispatcherOptions
): AsyncGenerator<AgentEvent> {
  let buffer = "";

  for await (const event of events) {
    if (event.type === "text" && event.content) {
      buffer += event.content;
    }

    if (event.type === "assistant-complete" || event.type === "result") {
      let text = buffer.trim();
      buffer = "";

      // Strip channel prefix if the model echoed it back
      const prefixPattern = new RegExp(
        `^\\[canal:\\s*${options.adapterSlug}\\]\\s*`
      );
      text = text.replace(prefixPattern, "").trim();

      if (text) {
        await deliverToChannel(options.channelId, options.agentId, text, {
          metadata: {
            recipientId: options.recipientId,
            ...options.metadata,
          },
        });
      }
    }

    yield event;
  }
}
