import { tool } from "ai";
import { z } from "zod";
import { getAgentMemoryManager } from "../manager.js";

export function createMemorySearchTool(agentId: string): Record<string, any> {
  return {
    memory_search: tool({
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
          const results = await mgr.search(args.query, {
            maxResults: args.maxResults,
          });
          return { results };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { results: [], error: msg };
        }
      },
    }),
  };
}
