import type { BackboneEventBus } from "../events/index.js";

export interface ChannelAdapterSendOptions {
  channelId: string;
  agentId: string;
  content: string;
  role?: "assistant" | "user" | "system";
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface InboundMessage {
  senderId: string;
  content: string;
  ts: number;
  metadata?: Record<string, unknown>;
}

export type InboundCallback = (channelId: string, message: InboundMessage) => void;

export interface ChannelAdapterContext {
  eventBus: BackboneEventBus;
  log: (msg: string) => void;
  env: Record<string, string | undefined>;
}

export type ChannelAdapterFactory = (
  config: Record<string, unknown>,
  context: ChannelAdapterContext
) => ChannelAdapter | Promise<ChannelAdapter>;

export interface ChannelAdapter {
  readonly slug: string;
  send(options: ChannelAdapterSendOptions): Promise<void>;
  onInbound?(callback: InboundCallback): void;
  health?(): { status: "healthy" | "degraded" | "unhealthy"; details?: Record<string, unknown> };
  close?(): Promise<void>;
}
