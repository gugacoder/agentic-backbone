import { z } from "zod";
import type { ToolDefinition } from "../../agent/tool-defs.js";
import { getAgentMemoryManager } from "../manager.js";

export function create(agentId: string): ToolDefinition {
  return {
    name: "memory_search",
    description:
      "Search the agent's memory using hybrid vector + keyword search. " +
      "Returns relevant snippets from MEMORY.md, journal entries, and other agent context files.",
    parameters: z.object({
      query: z.string().describe("Natural language search query"),
      maxResults: z
        .number()
        .optional()
        .describe("Maximum number of results to return (default: 6)"),
    }),
    execute: async (args) => {
      try {
        const mgr = getAgentMemoryManager(agentId);
        const results = await mgr.search(args.query, { maxResults: args.maxResults });
        return { results };
      } catch (err) {
        return { results: [], error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
