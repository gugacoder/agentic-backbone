import { z } from "zod";
import type { ToolDefinition } from "../../agent/tool-defs.js";
import { getJob } from "../engine.js";

export function create(): ToolDefinition {
  return {
    name: "get_job",
    description:
      "Get full details of a specific job including output tail (last 2000 chars), status, exit code, and duration.",
    parameters: z.object({
      jobId: z.string().describe("Job ID to query"),
    }),
    execute: async (args) => {
      const job = getJob(args.jobId);
      if (!job) return { error: "Job not found" };
      return job;
    },
  };
}
