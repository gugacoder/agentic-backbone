import { z } from "zod";
import type { ToolDefinition } from "../../agent/tool-defs.js";
import { listJobs } from "../engine.js";

export function create(): ToolDefinition {
  return {
    name: "list_jobs",
    description:
      "List all jobs for this agent. Returns an array of job summaries with id, status, command, tail output, etc.",
    parameters: z.object({}),
    execute: async () => {
      const agentId = process.env.AGENT_ID;
      return listJobs(agentId ?? undefined);
    },
  };
}
