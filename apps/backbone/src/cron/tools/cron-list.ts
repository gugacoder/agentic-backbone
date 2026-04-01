import { tool } from "ai";
import { z } from "zod";
import { listCronJobs } from "../index.js";
import { requireAgentId } from "./_schemas.js";

export function createCronListTool(): Record<string, any> {
  return {
    cron_list: tool({
      description:
        "List your scheduled cron jobs. Returns an array of job definitions with their current state.",
      parameters: z.object({
        includeDisabled: z.boolean().optional().describe("Include disabled jobs (default: false)"),
      }),
      execute: async (args) => {
        const agentId = requireAgentId();
        if (!agentId) return { error: "AGENT_ID not available" };
        return listCronJobs({ agentId, includeDisabled: args.includeDisabled });
      },
    }),
  };
}
