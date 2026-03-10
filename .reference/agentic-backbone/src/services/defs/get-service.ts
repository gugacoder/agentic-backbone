import { z } from "zod";
import type { ToolDefinition } from "../../agent/tool-defs.js";
import { getService } from "../engine.js";

export function create(): ToolDefinition {
  return {
    name: "get_service",
    description:
      "Get full details of a specific service execution including output tail (last 1000 chars), status, exit code, and duration.",
    parameters: z.object({
      serviceId: z.string().describe("Service execution ID to query"),
    }),
    execute: async (args) => {
      const service = getService(args.serviceId);
      if (!service) return { error: "Service execution not found" };
      return service;
    },
  };
}
