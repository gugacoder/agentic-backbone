import { z } from "zod";
import type { ToolDefinition } from "../../agent/tool-defs.js";
import { removeCronJob } from "../index.js";

export function create(): ToolDefinition {
  return {
    name: "cron_remove",
    description: "Delete a scheduled cron job permanently.",
    parameters: z.object({
      slug: z.string().describe("Slug of the job to delete"),
    }),
    execute: async (args) => {
      const agentId = process.env.AGENT_ID;
      if (!agentId) return { error: "AGENT_ID not available" };
      try {
        return { removed: await removeCronJob(agentId, args.slug) };
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
    },
  };
}
