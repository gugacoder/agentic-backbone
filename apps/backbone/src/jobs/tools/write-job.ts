import { tool } from "ai";
import { z } from "zod";
import { writeJob } from "../engine.js";

export function createWriteJobTool(): Record<string, any> {
  return {
    write_job: tool({
      description:
        "Write data to the stdin of a running job. Useful for interactive processes (e.g. sending input to 'cat', answering prompts).",
      parameters: z.object({
        jobId: z.string().describe("Job ID to write to"),
        data: z.string().describe("Data to write to stdin (include \\n for newlines)"),
      }),
      execute: async (args) => {
        const ok = writeJob(args.jobId, args.data);
        return { ok };
      },
    }),
  };
}
