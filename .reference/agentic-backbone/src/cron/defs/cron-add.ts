import { z } from "zod";
import type { ToolDefinition } from "../../agent/tool-defs.js";
import { addCronJob } from "../index.js";
import type { CronJobDef } from "../types.js";
import { scheduleSchema, payloadSchema, toSchedule, toPayload } from "./_schemas.js";

export function create(): ToolDefinition {
  return {
    name: "cron_add",
    description:
      "Create a new scheduled cron job. Use kind='at' for one-shot, kind='every' for interval, kind='cron' for cron expressions. Payload kind='heartbeat' triggers a heartbeat; kind='agentTurn' starts a conversation turn with the given message.",
    parameters: z.object({
      slug: z.string().describe("Unique slug for this job (used as filename)"),
      name: z.string().describe("Human-readable job name"),
      schedule: scheduleSchema,
      payload: payloadSchema,
      deleteAfterRun: z.boolean().optional().describe("Delete job after first successful run (useful for one-shot 'at' jobs)"),
      description: z.string().optional().describe("Optional description of what this job does"),
    }),
    execute: async (args) => {
      const agentId = process.env.AGENT_ID;
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
  };
}
