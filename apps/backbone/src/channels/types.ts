export interface ChannelConfig {
  slug: string;
  owner: string;
  type: string;
  metadata: Record<string, unknown>;
  description: string;
}

export interface ChannelMessage {
  channelId: string;
  agentId: string;
  role: "assistant" | "user" | "system";
  content: string;
  sessionId?: string;
}
