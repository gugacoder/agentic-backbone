import { tool } from "ai";
import { z } from "zod";
import { addCronJob } from "../index.js";
import type { CronJobDef } from "../types.js";
import { scheduleSchema, payloadSchema, toSchedule, toPayload, requireAgentId } from "./_schemas.js";

export function createCronAddTool(): Record<string, any> {
  return {
    cron_add: tool({
      description:
        "Create a new scheduled cron job. Use kind='at' for one-shot, kind='every' for interval, kind='cron' for cron expressions. Payload kind='heartbeat' triggers a heartbeat; kind='conversation' starts a conversation turn; kind='request' invokes the agent in request/API mode.",
      parameters: z.object({
        slug: z.string().describe("Unique slug for this job (used as filename)"),
        name: z.string().describe("Human-readable job name"),
        schedule: scheduleSchema,
        payload: payloadSchema,
        deleteAfterRun: z.boolean().optional().describe("Delete job after first successful run (useful for one-shot 'at' jobs)"),
        description: z.string().optional().describe("Optional description of what this job does"),
      }),
      execute: async (args) => {
        const agentId = requireAgentId();
        if (!agentId) return { error: "AGENT_ID not available" };
        try {
          const def: CronJobDef = {
            name: args.name,
            enabled: true,
            schedule: toSchedule(args.schedule),
            payload: toPayload(args.payload),
            ...(args.deleteAfterRun != null ? { deleteAfterRun: args.deleteAfterRun } : {}),
            ...(args.description ? { description: args.description } : {}),
          };
          return await addCronJob({ slug: args.slug, agentId, def });
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) };
        }
      },
    }),
  };
}
