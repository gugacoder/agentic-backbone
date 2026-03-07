import { tool } from "ai";
import { z } from "zod";
import { getCronStatus } from "../index.js";

export function createCronStatusTool(): Record<string, any> {
  return {
    cron_status: tool({
      description:
        "Get the cron scheduler status: whether it is enabled, job count, and next wake time.",
      parameters: z.object({}),
      execute: async () => getCronStatus(),
    }),
  };
}
