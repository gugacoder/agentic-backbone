import { tool } from "ai";
import { z } from "zod";
import { getJob } from "../engine.js";

export function createGetJobTool(): Record<string, any> {
  return {
    get_job: tool({
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
    }),
  };
}
