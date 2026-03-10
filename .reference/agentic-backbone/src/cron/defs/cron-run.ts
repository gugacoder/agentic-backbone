import { z } from "zod";
import type { ToolDefinition } from "../../agent/tool-defs.js";
import { runCronJob } from "../index.js";

export function create(): ToolDefinition {
  return {
    name: "cron_run",
    description:
      "Manually trigger a cron job right now. Use mode='force' to ignore disabled/not-due guards, or mode='due' (default) to respect them.",
    parameters: z.object({
      slug: z.string().describe("Slug of the job to run"),
      mode: z.enum(["due", "force"]).optional().describe("Execution mode (default: 'due')"),
    }),
    execute: async (args) => {
      const agentId = process.env.AGENT_ID;
      if (!agentId) return { error: "AGENT_ID not available" };
      try {
        return await runCronJob(agentId, args.slug, args.mode);
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
    },
  };
}
