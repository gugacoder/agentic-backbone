import { createSdkMcpServer, tool as sdkTool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

// Workaround: SDK expects zod v4 types but backbone uses zod v3.
const tool = sdkTool as (
  name: string,
  description: string,
  inputSchema: Record<string, any>,
  handler: (args: any, extra: unknown) => Promise<any>,
  extras?: any,
) => ReturnType<typeof sdkTool>;
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
      // Auto-captura: gravar contexto da conversa corrente
      ...(process.env.SESSION_ID ? { sessionId: process.env.SESSION_ID } : {}),
      ...(process.env.USER_ID ? { userId: process.env.USER_ID } : {}),
      ...(raw.context ? { context: raw.context } : {}),
    };
  }
  return { kind: "heartbeat" };
}

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

function err(msg: string) {
  return { content: [{ type: "text" as const, text: `Error: ${msg}` }] };
}

function requireAgentId(): string | null {
  return process.env.AGENT_ID ?? null;
}

export const cronMcpServer = createSdkMcpServer({
  name: "backbone-cron",
  version: "1.0.0",
  tools: [
    tool(
      "cron_status",
      "Get the cron scheduler status: whether it is enabled, job count, and next wake time.",
      {},
      async () => ok(getCronStatus())
    ),

    tool(
      "cron_list",
      "List your scheduled cron jobs. Returns an array of job definitions with their current state.",
      {
        includeDisabled: z.boolean().optional().describe("Include disabled jobs (default: false)"),
      },
      async (args) => {
        const agentId = requireAgentId();
        if (!agentId) return err("AGENT_ID not available");
        return ok(listCronJobs({ agentId, includeDisabled: args.includeDisabled }));
      }
    ),

    tool(
      "cron_add",
      "Create a new scheduled cron job. Use kind='at' for one-shot, kind='every' for interval, kind='cron' for cron expressions. Payload kind='heartbeat' triggers a heartbeat; kind='agentTurn' starts a conversation turn with the given message.",
      {
        slug: z.string().describe("Unique slug for this job (used as filename)"),
        name: z.string().describe("Human-readable job name"),
        schedule: scheduleSchema,
        payload: payloadSchema,
        deleteAfterRun: z.boolean().optional().describe("Delete job after first successful run (useful for one-shot 'at' jobs)"),
        description: z.string().optional().describe("Optional description of what this job does"),
      },
      async (args) => {
        const agentId = requireAgentId();
        if (!agentId) return err("AGENT_ID not available");
        try {
          const def: CronJobDef = {
            name: args.name,
            enabled: true,
            schedule: toSchedule(args.schedule),
            payload: toPayload(args.payload),
            ...(args.deleteAfterRun != null ? { deleteAfterRun: args.deleteAfterRun } : {}),
            ...(args.description ? { description: args.description } : {}),
          };
          const job = await addCronJob({ slug: args.slug, agentId, def });
          return ok(job);
        } catch (e) {
          return err(e instanceof Error ? e.message : String(e));
        }
      }
    ),

    tool(
      "cron_update",
      "Update an existing cron job. Only provided fields are changed; omitted fields keep their current value.",
      {
        slug: z.string().describe("Slug of the job to update"),
        name: z.string().optional().describe("New job name"),
        enabled: z.boolean().optional().describe("Enable or disable the job"),
        schedule: scheduleSchema.optional().describe("New schedule"),
        payload: payloadSchema.optional().describe("New payload"),
        deleteAfterRun: z.boolean().optional().describe("New deleteAfterRun value"),
        description: z.string().optional().describe("New description"),
      },
      async (args) => {
        const agentId = requireAgentId();
        if (!agentId) return err("AGENT_ID not available");
        try {
          const patch: Record<string, unknown> = {};
          if (args.name != null) patch.name = args.name;
          if (args.enabled != null) patch.enabled = args.enabled;
          if (args.schedule) patch.schedule = toSchedule(args.schedule);
          if (args.payload) patch.payload = toPayload(args.payload);
          if (args.deleteAfterRun != null) patch.deleteAfterRun = args.deleteAfterRun;
          if (args.description != null) patch.description = args.description;
          const job = await updateCronJob(agentId, args.slug, patch);
          return ok(job);
        } catch (e) {
          return err(e instanceof Error ? e.message : String(e));
        }
      }
    ),

    tool(
      "cron_remove",
      "Delete a scheduled cron job permanently.",
      {
        slug: z.string().describe("Slug of the job to delete"),
      },
      async (args) => {
        const agentId = requireAgentId();
        if (!agentId) return err("AGENT_ID not available");
        try {
          const removed = await removeCronJob(agentId, args.slug);
          return ok({ removed });
        } catch (e) {
          return err(e instanceof Error ? e.message : String(e));
        }
      }
    ),

    tool(
      "cron_run",
      "Manually trigger a cron job right now. Use mode='force' to ignore disabled/not-due guards, or mode='due' (default) to respect them.",
      {
        slug: z.string().describe("Slug of the job to run"),
        mode: z.enum(["due", "force"]).optional().describe("Execution mode (default: 'due')"),
      },
      async (args) => {
        const agentId = requireAgentId();
        if (!agentId) return err("AGENT_ID not available");
        try {
          const result = await runCronJob(agentId, args.slug, args.mode);
          return ok(result);
        } catch (e) {
          return err(e instanceof Error ? e.message : String(e));
        }
      }
    ),

    tool(
      "cron_runs",
      "Get the execution history of a cron job. Returns recent runs with status, duration, and error details.",
      {
        slug: z.string().describe("Slug of the job to query"),
        limit: z.number().optional().describe("Max entries to return (default: 50)"),
        offset: z.number().optional().describe("Skip N entries for pagination"),
      },
      async (args) => {
        try {
          const result = getCronRunHistory(args.slug, {
            limit: args.limit,
            offset: args.offset,
          });
          return ok(result);
        } catch (e) {
          return err(e instanceof Error ? e.message : String(e));
        }
      }
    ),
  ],
});
