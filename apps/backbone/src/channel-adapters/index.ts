import { channelAdapterRegistry } from "./registry.js";
import { sseAdapterFactory } from "./sse.js";
import { discoverDropInAdapters } from "./discovery.js";

export async function initChannelAdapters(): Promise<void> {
  // 1. Built-in: SSE (always present)
  channelAdapterRegistry.register("sse", sseAdapterFactory);
  console.log("[channel-adapters] registered built-in: sse");

  // 2. Drop-in: filesystem discovery
  await discoverDropInAdapters();

  // 3. Plug-in: modules register via startModules() after this
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
