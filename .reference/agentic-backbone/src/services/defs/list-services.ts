import { z } from "zod";
import type { ToolDefinition } from "../../agent/tool-defs.js";
import { listServices } from "../engine.js";

export function create(): ToolDefinition {
  return {
    name: "list_services",
    description:
      "List all running/finished service executions for this agent. Returns an array of service summaries with id, status, slug, tail output, etc.",
    parameters: z.object({}),
    execute: async () => {
      const agentId = process.env.AGENT_ID;
      return listServices(agentId ?? undefined);
    },
  };
}
