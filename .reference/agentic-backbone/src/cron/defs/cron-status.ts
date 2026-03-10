import { z } from "zod";
import type { ToolDefinition } from "../../agent/tool-defs.js";
import { getCronStatus } from "../index.js";

export function create(): ToolDefinition {
  return {
    name: "cron_status",
    description:
      "Get the cron scheduler status: whether it is enabled, job count, and next wake time.",
    parameters: z.object({}),
    execute: async () => getCronStatus(),
  };
}
