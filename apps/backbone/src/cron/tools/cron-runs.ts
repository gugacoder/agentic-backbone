import { tool } from "ai";
import { z } from "zod";
import { getCronRunHistory } from "../index.js";
import { formatError } from "../../utils/errors.js";

export function createCronRunsTool(): Record<string, any> {
  return {
    cron_runs: tool({
      description:
        "Get the execution history of a cron job. Returns recent runs with status, duration, and error details.",
      parameters: z.object({
        slug: z.string().describe("Slug of the job to query"),
        limit: z.number().optional().describe("Max entries to return (default: 50)"),
        offset: z.number().optional().describe("Skip N entries for pagination"),
      }),
      execute: async (args) => {
        try {
          return getCronRunHistory(args.slug, {
            limit: args.limit,
            offset: args.offset,
          });
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) };
        }
      },
    }),
  };
}
