/**
 * Backbone agent utility types.
 *
 * UsageData is extracted from SDKResultMessage by consumers that need
 * cost/token tracking (conversations, heartbeat, cron, telemetry).
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
