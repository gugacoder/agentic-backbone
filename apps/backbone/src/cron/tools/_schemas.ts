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
  kind: z.enum(["heartbeat", "conversation", "request"]),
  message: z.string().optional().describe("Message for conversation/request payload"),
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
  if (raw.kind === "conversation" || raw.kind === "request") {
    return { kind: raw.kind, message: raw.message ?? "" };
  }
  return { kind: "heartbeat" };
}

export function requireAgentId(): string | null {
  return process.env.AGENT_ID ?? null;
}
