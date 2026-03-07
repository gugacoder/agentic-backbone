import { channelAdapterRegistry } from "./registry.js";
import { sseAdapterFactory } from "./sse.js";

export async function initChannelAdapters(): Promise<void> {
  // Built-in: SSE (always present)
  channelAdapterRegistry.register("sse", sseAdapterFactory);
  console.log("[channel-adapters] registered built-in: sse");

  // Connector channel-adapters are registered via connectorRegistry.startAll()
}

export { channelAdapterRegistry } from "./registry.js";
export type {
  ChannelAdapter,
  ChannelAdapterFactory,
  ChannelAdapterContext,
  ChannelAdapterSendOptions,
  InboundMessage,
  InboundCallback,
} from "./types.js";
