import { tool } from "ai";
import { z } from "zod";
import { updateCronJob } from "../index.js";
import { scheduleSchema, payloadSchema, toSchedule, toPayload, requireAgentId } from "./_schemas.js";
import { formatError } from "../../utils/errors.js";

export function createCronUpdateTool(): Record<string, any> {
  return {
    cron_update: tool({
      description:
        "Update an existing cron job. Only provided fields are changed; omitted fields keep their current value.",
      parameters: z.object({
        slug: z.string().describe("Slug of the job to update"),
        name: z.string().optional().describe("New job name"),
        enabled: z.boolean().optional().describe("Enable or disable the job"),
        schedule: scheduleSchema.optional().describe("New schedule"),
        payload: payloadSchema.optional().describe("New payload"),
        deleteAfterRun: z.boolean().optional().describe("New deleteAfterRun value"),
        description: z.string().optional().describe("New description"),
      }),
      execute: async (args) => {
        const agentId = requireAgentId();
        if (!agentId) return { error: "AGENT_ID not available" };
        try {
          const patch: Record<string, unknown> = {};
          if (args.name != null) patch.name = args.name;
          if (args.enabled != null) patch.enabled = args.enabled;
          if (args.schedule) patch.schedule = toSchedule(args.schedule);
          if (args.payload) patch.payload = toPayload(args.payload);
          if (args.deleteAfterRun != null) patch.deleteAfterRun = args.deleteAfterRun;
          if (args.description != null) patch.description = args.description;
          return await updateCronJob(agentId, args.slug, patch);
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) };
        }
      },
    }),
  };
}
