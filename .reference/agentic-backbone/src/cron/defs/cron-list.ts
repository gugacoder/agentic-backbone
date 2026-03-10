import { z } from "zod";
import type { ToolDefinition } from "../../agent/tool-defs.js";
import { listCronJobs } from "../index.js";

export function create(): ToolDefinition {
  return {
    name: "cron_list",
    description:
      "List your scheduled cron jobs. Returns an array of job definitions with their current state.",
    parameters: z.object({
      includeDisabled: z.boolean().optional().describe("Include disabled jobs (default: false)"),
    }),
    execute: async (args) => {
      const agentId = process.env.AGENT_ID;
      if (!agentId) return { error: "AGENT_ID not available" };
      return listCronJobs({ agentId, includeDisabled: args.includeDisabled });
    },
  };
}
