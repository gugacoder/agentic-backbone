import { z } from "zod";

export const CircuitBreakerConfigSchema = z.object({
  agentId: z.string(),
  enabled: z.boolean().default(true),
  maxConsecutiveFails: z.number().int().positive().default(5),
  errorRateThreshold: z.number().min(0).max(1).default(0.5),
  errorRateWindowMin: z.number().int().positive().default(10),
  maxActionsPerHour: z.number().int().positive().default(100),
  maxActionsPerDay: z.number().int().positive().default(1000),
  cooldownMin: z.number().int().positive().default(30),
  autoResume: z.boolean().default(false),
});

export type CircuitBreakerConfig = z.infer<typeof CircuitBreakerConfigSchema>;

export const CircuitBreakerConfigUpdateSchema = CircuitBreakerConfigSchema.omit({ agentId: true }).partial();

export type CircuitBreakerConfigUpdate = z.infer<typeof CircuitBreakerConfigUpdateSchema>;

export const CircuitBreakerStateSchema = z.object({
  agentId: z.string(),
  killSwitch: z.boolean(),
  tripped: z.boolean(),
  trippedAt: z.string().nullable(),
  resumeAt: z.string().nullable(),
  consecutiveFails: z.number().int(),
  actionsThisHour: z.number().int(),
  actionsToday: z.number().int(),
});

export type CircuitBreakerState = z.infer<typeof CircuitBreakerStateSchema>;

export const EventTypeSchema = z.enum([
  "tripped",
  "resumed",
  "kill_switch_on",
  "kill_switch_off",
  "action_blocked",
]);

export type EventType = z.infer<typeof EventTypeSchema>;

export interface CircuitBreakerEvent {
  id: string;
  agentId: string;
  eventType: EventType;
  triggerReason: string | null;
  context: string | null;
  actor: string | null;
  createdAt: string;
}
