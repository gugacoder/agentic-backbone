export interface UsageData {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  totalCostUsd: number;
  numTurns: number;
  durationMs: number;
  durationApiMs: number;
  stopReason: string;
}

export interface AgentEvent {
  type: "init" | "text" | "result" | "usage";
  sessionId?: string;
  content?: string;
  usage?: UsageData;
}
