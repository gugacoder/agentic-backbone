export interface ChannelConfig {
  slug: string;
  owner: string;
  type: string;
  description: string;
  agent?: string;
  "channel-adapter"?: string;
  options: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface ChannelMessage {
  channelId: string;
  agentId: string;
  role: "assistant" | "user" | "system";
  content: string;
  sessionId?: string;
}
