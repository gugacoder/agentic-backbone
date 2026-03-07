import { tool } from "ai";
import { z } from "zod";
import { pollJob } from "../engine.js";

export function createPollJobTool(): Record<string, any> {
  return {
    poll_job: tool({
      description:
        "Drain pending output since last poll. Returns only new chunks (delta). Use this for incremental monitoring of running jobs.",
      parameters: z.object({
        jobId: z.string().describe("Job ID to poll"),
      }),
      execute: async (args) => {
        const result = pollJob(args.jobId);
        if (!result) return { error: "Job not found" };
        return result;
      },
    }),
  };
}
