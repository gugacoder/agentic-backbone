export interface KaiAgentEvent {
  type: "init" | "text" | "result" | "usage";
  sessionId?: string;
  content?: string;
  usage?: KaiUsageData;
}

export interface KaiUsageData {
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

export interface KaiAgentOptions {
  model: string;
  apiKey: string;
  sessionId?: string;
  sessionDir?: string;
  maxSteps?: number;
  system?: string;
}
