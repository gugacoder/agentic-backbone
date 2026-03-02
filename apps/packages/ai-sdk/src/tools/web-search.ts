import { tool } from "ai";
import { z } from "zod";

const MAX_OUTPUT = 50_000;

/**
 * A single search result returned by a WebSearch provider.
 */
export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Callback type for pluggable web search providers.
 * Implementors receive the query and desired number of results,
 * and return an array of WebSearchResult.
 */
export type WebSearchProvider = (
  query: string,
  numResults: number
) => Promise<WebSearchResult[]>;

/**
 * Factory that creates the WebSearch tool with an injected search provider.
 * If no provider is given, returns a tool that explains no provider is configured.
 */
export function createWebSearchTool(searchProvider?: WebSearchProvider) {
  return tool({
    description:
      "Search the web and return formatted results with title, URL, and snippet. Use this to find up-to-date information, documentation, or answers to questions.",
    inputSchema: z.object({
      query: z.string().describe("The search query"),
      numResults: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .default(5)
        .describe("Number of results to return (default: 5)"),
    }),
    execute: async ({ query, numResults }) => {
      if (!searchProvider) {
        return "WebSearch provider not configured. The consuming application must provide an onWebSearch callback in AiAgentOptions to enable web search.";
      }

      try {
        const results = await searchProvider(query, numResults);

        if (results.length === 0) {
          return `No results found for: "${query}"`;
        }

        let output = `# Search results for: "${query}"\n\n`;

        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          output += `## ${i + 1}. ${r.title}\n`;
          output += `**URL:** ${r.url}\n`;
          output += `${r.snippet}\n\n`;
        }

        if (output.length > MAX_OUTPUT) {
          output = output.slice(0, MAX_OUTPUT) + "\n...[truncated at 50KB]";
        }

        return output.trim();
      } catch (err: any) {
        return `Error searching web: ${err.message}`;
      }
    },
  });
}
