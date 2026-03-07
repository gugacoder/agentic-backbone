import { tool } from "ai";
import { z } from "zod";
import { killJob } from "../engine.js";

export function createKillJobTool(): Record<string, any> {
  return {
    kill_job: tool({
      description: "Kill a running job with SIGKILL.",
      parameters: z.object({
        jobId: z.string().describe("Job ID to kill"),
      }),
      execute: async (args) => {
        const killed = killJob(args.jobId);
        return { killed };
      },
    }),
  };
}
