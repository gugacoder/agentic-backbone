import { z } from "zod";
import type { ToolDefinition } from "../../agent/tool-defs.js";
import { killJob } from "../engine.js";

export function create(): ToolDefinition {
  return {
    name: "kill_job",
    description: "Kill a running job with SIGKILL.",
    parameters: z.object({
      jobId: z.string().describe("Job ID to kill"),
    }),
    execute: async (args) => {
      const killed = killJob(args.jobId);
      return { success: killed, message: killed ? "Job killed successfully" : "Job not found or already finished" };
    },
  };
}
