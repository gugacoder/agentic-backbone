import { z } from "zod";
import type { CronSchedule, CronPayload } from "../types.js";

export const scheduleSchema = z.object({
  kind: z.enum(["at", "every", "cron"]),
  at: z.string().optional().describe("ISO-8601 datetime for one-shot jobs (kind='at')"),
  everyMs: z.number().optional().describe("Interval in ms (kind='every')"),
  expr: z.string().optional().describe("Cron expression, e.g. '0 9 * * *' (kind='cron')"),
  tz: z.string().optional().describe("IANA timezone for cron, e.g. 'America/Sao_Paulo'"),
});

export const payloadSchema = z.object({
  kind: z.enum(["heartbeat", "agentTurn", "request", "service"]),
  message: z.string().optional().describe("Message for agentTurn payload"),
  context: z.string().optional().describe("Arbitrary payload you will receive back when awakened by cron. Use for task specs, structured data, or any info your future self needs."),
  service: z.string().optional().describe("Service slug for request/service payload"),
  input: z.object({}).passthrough().optional().describe("Input for service"),
});

export function toSchedule(raw: z.infer<typeof scheduleSchema>): CronSchedule {
  switch (raw.kind) {
    case "at":
      return { kind: "at", at: raw.at! };
    case "every":
      return { kind: "every", everyMs: raw.everyMs! };
    case "cron":
      return { kind: "cron", expr: raw.expr!, ...(raw.tz ? { tz: raw.tz } : {}) };
  }
}

export function toPayload(raw: z.infer<typeof payloadSchema>): CronPayload {
  if (raw.kind === "agentTurn") {
    return {
      kind: "agentTurn",
      message: raw.message ?? "",
      ...(process.env.SESSION_ID ? { sessionId: process.env.SESSION_ID } : {}),
      ...(process.env.USER_ID ? { userId: process.env.USER_ID } : {}),
      ...(raw.context ? { context: raw.context } : {}),
    };
  }
  if (raw.kind === "service") {
    return {
      kind: "service",
      service: raw.service ?? "",
      ...(raw.input ? { input: raw.input as Record<string, unknown> } : {}),
    };
  }
  if (raw.kind === "request") {
    return {
      kind: "request",
      ...(raw.service ? { service: raw.service } : {}),
      ...(raw.input ? { input: raw.input as Record<string, unknown> } : {}),
    };
  }
  return { kind: "heartbeat" };
}
