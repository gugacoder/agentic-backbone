import { tool } from "ai";
import { z } from "zod";
import { removeCronJob } from "../index.js";
import { requireAgentId } from "./_schemas.js";
import { formatError } from "../../utils/errors.js";

export function createCronRemoveTool(): Record<string, any> {
  return {
    cron_remove: tool({
      description: "Delete a scheduled cron job permanently.",
      parameters: z.object({
        slug: z.string().describe("Slug of the job to delete"),
      }),
      execute: async (args) => {
        const agentId = requireAgentId();
        if (!agentId) return { error: "AGENT_ID not available" };
        try {
          const removed = await removeCronJob(agentId, args.slug);
          return { removed };
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) };
        }
      },
    }),
  };
}
