import { tool } from "ai";
import { z } from "zod";

const MAX_OUTPUT = 50_000;

/**
 * A single code search result returned by a CodeSearch provider.
 */
export interface CodeSearchResult {
  title: string;
  url: string;
  content: string;
}

/**
 * Callback type for pluggable code search providers.
 * Implementors receive the query and return code examples and documentation snippets.
 */
export type CodeSearchProvider = (
  query: string
) => Promise<CodeSearchResult[]>;

/**
 * Factory that creates the CodeSearch tool with an injected search provider.
 * If no provider is given, returns a tool that explains no provider is configured.
 */
export function createCodeSearchTool(searchProvider?: CodeSearchProvider) {
  return tool({
    description:
      "Search for code examples, API documentation, and library patterns online. Use this to find usage examples, best practices, and documentation for APIs and libraries.",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "Search query about APIs, libraries, or coding patterns (e.g. 'zod v4 migration', 'express middleware error handling')"
        ),
    }),
    execute: async ({ query }) => {
      if (!searchProvider) {
        return "CodeSearch provider not configured. The consuming application must provide an onCodeSearch callback in AiAgentOptions to enable code search.";
      }

      try {
        const results = await searchProvider(query);

        if (results.length === 0) {
          return `No code examples found for: "${query}"`;
        }

        let output = `# Code search results for: "${query}"\n\n`;

        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          output += `## ${i + 1}. ${r.title}\n`;
          output += `**Source:** ${r.url}\n\n`;
          output += `${r.content}\n\n`;
        }

        if (output.length > MAX_OUTPUT) {
          output = output.slice(0, MAX_OUTPUT) + "\n...[truncated at 50KB]";
        }

        return output.trim();
      } catch (err: any) {
        return `Error searching code: ${err.message}`;
      }
    },
  });
}
