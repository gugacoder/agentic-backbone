import { eventBus } from "../events/index.js";

export function deliverToChannel(
  channelId: string,
  agentId: string,
  content: string,
  options?: { role?: "assistant" | "user" | "system"; sessionId?: string }
): void {
  eventBus.emit("channel:message", {
    ts: Date.now(),
    channelId,
    agentId,
    role: options?.role ?? "assistant",
    content,
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
