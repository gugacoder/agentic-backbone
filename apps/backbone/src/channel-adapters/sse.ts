import { eventBus } from "../events/index.js";
import type { ChannelAdapter, ChannelAdapterFactory } from "./types.js";

const sseAdapter: ChannelAdapter = {
  slug: "sse",

  async send({ channelId, agentId, content, role, sessionId }) {
    eventBus.emit("channel:message", {
      ts: Date.now(),
      channelId,
      agentId,
      role: role ?? "assistant",
      content,
      sessionId,
    });
  },
};

export const sseAdapterFactory: ChannelAdapterFactory = () => sseAdapter;
