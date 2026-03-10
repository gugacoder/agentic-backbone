import { z } from "zod";
import type { ToolDefinition } from "../../agent/tool-defs.js";
import { killService } from "../engine.js";

export function create(): ToolDefinition {
  return {
    name: "kill_service",
    description: "Kill a running service execution with SIGKILL.",
    parameters: z.object({
      serviceId: z.string().describe("Service execution ID to kill"),
    }),
    execute: async (args) => {
      const killed = killService(args.serviceId);
      return { success: killed, message: killed ? "Service killed successfully" : "Service not found or already finished" };
    },
  };
}
