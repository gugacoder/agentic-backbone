import { tool } from "ai";
import { z } from "zod";
import {
  getCronStatus,
  listCronJobs,
  addCronJob,
  updateCronJob,
  removeCronJob,
  runCronJob,
  getCronRunHistory,
} from "./index.js";
import type { CronSchedule, CronPayload, CronJobDef } from "./types.js";

const scheduleSchema = z.object({
  kind: z.enum(["at", "every", "cron"]),
  at: z.string().optional().describe("ISO-8601 datetime for one-shot jobs (kind='at')"),
  everyMs: z.number().optional().describe("Interval in ms (kind='every')"),
  expr: z.string().optional().describe("Cron expression, e.g. '0 9 * * *' (kind='cron')"),
  tz: z.string().optional().describe("IANA timezone for cron, e.g. 'America/Sao_Paulo'"),
});

const payloadSchema = z.object({
  kind: z.enum(["heartbeat", "agentTurn"]),
  message: z.string().optional().describe("Message for agentTurn payload"),
  context: z.string().optional().describe("Arbitrary payload you will receive back when awakened by cron. Use for task specs, structured data, or any info your future self needs."),
});

function toSchedule(raw: z.infer<typeof scheduleSchema>): CronSchedule {
  switch (raw.kind) {
    case "at":
      return { kind: "at", at: raw.at! };
    case "every":
      return { kind: "every", everyMs: raw.everyMs! };
    case "cron":
      return { kind: "cron", expr: raw.expr!, ...(raw.tz ? { tz: raw.tz } : {}) };
  }
}

function toPayload(raw: z.infer<typeof payloadSchema>): CronPayload {
  if (raw.kind === "agentTurn") {
    return {
      kind: "agentTurn",
      message: raw.message ?? "",
      ...(process.env.SESSION_ID ? { sessionId: process.env.SESSION_ID } : {}),
      ...(process.env.USER_ID ? { userId: process.env.USER_ID } : {}),
      ...(raw.context ? { context: raw.context } : {}),
    };
  }
  return { kind: "heartbeat" };
}

/**
 * Creates Vercel AI SDK tools for cron scheduling.
 * Used by the Ai provider path (which cannot use in-process MCP servers).
 */
export function createCronAiTools(): Record<string, any> {
  return {
    cron_status: tool({
      description: "Get the cron scheduler status: whether it is enabled, job count, and next wake time.",
      parameters: z.object({}),
      execute: async () => getCronStatus(),
    }),

    cron_list: tool({
      description: "List your scheduled cron jobs. Returns an array of job definitions with their current state.",
      parameters: z.object({
        includeDisabled: z.boolean().optional().describe("Include disabled jobs (default: false)"),
      }),
      execute: async (args) => {
        const agentId = process.env.AGENT_ID;
        if (!agentId) return { error: "AGENT_ID not available" };
        return listCronJobs({ agentId, includeDisabled: args.includeDisabled });
      },
    }),

    cron_add: tool({
      description: "Create a new scheduled cron job. Use kind='at' for one-shot, kind='every' for interval, kind='cron' for cron expressions. Payload kind='heartbeat' triggers a heartbeat; kind='agentTurn' starts a conversation turn with the given message.",
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
        const def: CronJobDef = {
          name: args.name,
          enabled: true,
          schedule: toSchedule(args.schedule),
          payload: toPayload(args.payload),
          ...(args.deleteAfterRun != null ? { deleteAfterRun: args.deleteAfterRun } : {}),
          ...(args.description ? { description: args.description } : {}),
        };
        const job = await addCronJob({ slug: args.slug, agentId, def });
        return { slug: job.slug, agentId: job.agentId, def: job.def, state: job.state };
      },
    }),

    cron_update: tool({
      description: "Update an existing cron job. Only provided fields are changed; omitted fields keep their current value.",
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
        const agentId = process.env.AGENT_ID;
        if (!agentId) return { error: "AGENT_ID not available" };
        const patch: Record<string, unknown> = {};
        if (args.name != null) patch.name = args.name;
        if (args.enabled != null) patch.enabled = args.enabled;
        if (args.schedule) patch.schedule = toSchedule(args.schedule);
        if (args.payload) patch.payload = toPayload(args.payload);
        if (args.deleteAfterRun != null) patch.deleteAfterRun = args.deleteAfterRun;
        if (args.description != null) patch.description = args.description;
        const job = await updateCronJob(agentId, args.slug, patch);
        return { slug: job.slug, agentId: job.agentId, def: job.def, state: job.state };
      },
    }),

    cron_remove: tool({
      description: "Delete a scheduled cron job permanently.",
      parameters: z.object({
        slug: z.string().describe("Slug of the job to delete"),
      }),
      execute: async (args) => {
        const agentId = process.env.AGENT_ID;
        if (!agentId) return { error: "AGENT_ID not available" };
        const removed = await removeCronJob(agentId, args.slug);
        return { removed };
      },
    }),

    cron_run: tool({
      description: "Manually trigger a cron job right now. Use mode='force' to ignore disabled/not-due guards, or mode='due' (default) to respect them.",
      parameters: z.object({
        slug: z.string().describe("Slug of the job to run"),
        mode: z.enum(["due", "force"]).optional().describe("Execution mode (default: 'due')"),
      }),
      execute: async (args) => {
        const agentId = process.env.AGENT_ID;
        if (!agentId) return { error: "AGENT_ID not available" };
        return await runCronJob(agentId, args.slug, args.mode);
      },
    }),

    cron_runs: tool({
      description: "Get the execution history of a cron job. Returns recent runs with status, duration, and error details.",
      parameters: z.object({
        slug: z.string().describe("Slug of the job to query"),
        limit: z.number().optional().describe("Max entries to return (default: 50)"),
        offset: z.number().optional().describe("Skip N entries for pagination"),
      }),
      execute: async (args) => {
        return getCronRunHistory(args.slug, {
          limit: args.limit,
          offset: args.offset,
        });
      },
    }),
  };
}
