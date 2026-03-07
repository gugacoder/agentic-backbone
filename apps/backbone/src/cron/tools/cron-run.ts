import { tool } from "ai";
import { z } from "zod";
import { runCronJob } from "../index.js";
import { requireAgentId } from "./_schemas.js";

export function createCronRunTool(): Record<string, any> {
  return {
    cron_run: tool({
      description:
        "Manually trigger a cron job right now. Use mode='force' to ignore disabled/not-due guards, or mode='due' (default) to respect them.",
      parameters: z.object({
        slug: z.string().describe("Slug of the job to run"),
        mode: z.enum(["due", "force"]).optional().describe("Execution mode (default: 'due')"),
      }),
      execute: async (args) => {
        const agentId = requireAgentId();
        if (!agentId) return { error: "AGENT_ID not available" };
        try {
          return await runCronJob(agentId, args.slug, args.mode);
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) };
        }
      },
    }),
  };
}
