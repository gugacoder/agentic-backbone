import { eventBus } from "../events/index.js";
import { getChannel } from "../channels/registry.js";
import { channelAdapterRegistry } from "../channel-adapters/index.js";

export async function deliverToChannel(
  channelId: string,
  agentId: string,
  content: string,
  options?: { role?: "assistant" | "user" | "system"; sessionId?: string }
): Promise<void> {
  const channel = getChannel(channelId);
  const adapterSlug = (channel?.metadata?.["channel-adapter"] as string) ?? "sse";
  const config = channel?.metadata ?? {};
  const adapter = await channelAdapterRegistry.resolve(adapterSlug, config);
  await adapter.send({
    channelId,
    agentId,
    content,
    role: options?.role ?? "assistant",
    sessionId: options?.sessionId,
  });
}

export function deliverToSystemChannel(
  agentId: string,
  content: string,
  options?: { role?: "assistant" | "user" | "system"; sessionId?: string }
): void {
  eventBus.emit("channel:message", {
    ts: Date.now(),
    channelId: "system-channel",
    agentId,
    role: options?.role ?? "assistant",
    content,
    sessionId: options?.sessionId,
  });
}

export function isSystemChannelActive(): boolean {
  return true;
}
