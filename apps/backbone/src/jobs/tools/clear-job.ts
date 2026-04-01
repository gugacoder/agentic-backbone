import { tool } from "ai";
import { z } from "zod";
import { clearJob } from "../engine.js";

export function createClearJobTool(): Record<string, any> {
  return {
    clear_job: tool({
      description: "Clear a finished job from memory.",
      parameters: z.object({
        jobId: z.string().describe("Job ID to clear"),
      }),
      execute: async (args) => {
        const cleared = clearJob(args.jobId);
        return { cleared };
      },
    }),
  };
}
