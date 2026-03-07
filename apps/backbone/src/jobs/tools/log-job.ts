import { tool } from "ai";
import { z } from "zod";
import { logJob } from "../engine.js";

export function createLogJobTool(): Record<string, any> {
  return {
    log_job: tool({
      description:
        "Read the full stdout/stderr log of a job with optional pagination (offset/limit).",
      parameters: z.object({
        jobId: z.string().describe("Job ID to read logs from"),
        offset: z.number().optional().describe("Start offset in chars (default: 0)"),
        limit: z.number().optional().describe("Max chars to return (default: 200000)"),
      }),
      execute: async (args) => {
        const result = logJob(args.jobId, args.offset, args.limit);
        if (!result) return { error: "Job not found" };
        return result;
      },
    }),
  };
}
