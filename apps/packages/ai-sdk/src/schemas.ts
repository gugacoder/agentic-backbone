import { z } from "zod";

// --- Usage ---
export const UsageDataSchema = z.object({
  inputTokens: z.number(),
  outputTokens: z.number(),
  cacheReadInputTokens: z.number().default(0),
  cacheCreationInputTokens: z.number().default(0),
  totalCostUsd: z.number().default(0),
  numTurns: z.number().default(0),
  durationMs: z.number().default(0),
  durationApiMs: z.number().default(0),
  stopReason: z.string().default("unknown"),
});

// --- Events (o que o proxy emite) ---
export const AgentEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("init"), sessionId: z.string().optional() }),
  z.object({ type: z.literal("text"), content: z.string() }),
  z.object({ type: z.literal("result"), content: z.string() }),
  z.object({ type: z.literal("usage"), usage: UsageDataSchema }),
]);

// --- Options (o que o backbone passa) ---
export const AgentRunOptionsSchema = z.object({
  provider: z.string(),
  model: z.string(),
  apiKey: z.string(),
  prompt: z.string(),
  sessionId: z.string().optional(),
  sessionDir: z.string().optional(),
  role: z.string().optional(),
  tools: z.record(z.any()).optional(),
  maxTurns: z.number().optional(),
  providerConfig: z.record(z.any()).optional(),
});

export type AgentEvent = z.infer<typeof AgentEventSchema>;
export type UsageData = z.infer<typeof UsageDataSchema>;
export type AgentRunOptions = z.infer<typeof AgentRunOptionsSchema>;
