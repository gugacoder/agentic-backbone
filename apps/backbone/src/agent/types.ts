/**
 * Backbone agent event types.
 *
 * Consumers use these types only — they never touch SDKMessage directly.
 * The mapping from SDKMessage → AgentEvent happens in agent/index.ts.
 */

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

export type AgentEvent =
  | { type: "text"; content: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; args: unknown }
  | { type: "tool-result"; toolCallId: string; result: unknown }
  | { type: "usage"; usage: UsageData }
  | { type: "result"; content: string }
  | { type: "assistant-complete" }
  | { type: "reasoning"; content: string }
  | { type: "init"; sessionId: string };
