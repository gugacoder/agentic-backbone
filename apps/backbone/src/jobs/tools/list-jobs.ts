import { tool } from "ai";
import { z } from "zod";
import { listJobs } from "../engine.js";

export function createListJobsTool(): Record<string, any> {
  return {
    list_jobs: tool({
      description:
        "List all jobs for this agent. Returns an array of job summaries with id, status, command, tail output, etc.",
      parameters: z.object({}),
      execute: async () => {
        const agentId = process.env.AGENT_ID;
        return listJobs(agentId ?? undefined);
      },
    }),
  };
}
