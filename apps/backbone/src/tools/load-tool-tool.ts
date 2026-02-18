import { tool } from "ai";
import { z } from "zod";
import type { ResolvedResource } from "../context/resolver.js";

/**
 * Creates a Vercel AI SDK tool that lets the agent load a context tool's
 * full TOOL.md content by name. The data is pre-loaded — no filesystem access at runtime.
 */
export function createLoadToolTool(tools: ResolvedResource[]) {
  const byName = new Map<string, ResolvedResource>();
  for (const t of tools) {
    const name = (t.metadata.name as string) ?? t.slug;
    byName.set(name.toLowerCase(), t);
    if (t.slug.toLowerCase() !== name.toLowerCase()) {
      byName.set(t.slug.toLowerCase(), t);
    }
  }

  const availableNames = tools.map(
    (t) => (t.metadata.name as string) ?? t.slug
  );

  return tool({
    description:
      "Load a context tool's full instructions by name. Returns the complete TOOL.md content and path. Use this instead of reading tool files directly.",
    parameters: z.object({
      name: z.string().describe("Name of the tool to load"),
    }),
    execute: async ({ name }) => {
      const entry = byName.get(name.toLowerCase());
      if (!entry) {
        return `Tool "${name}" not found. Available tools: ${availableNames.join(", ")}`;
      }
      return {
        name: (entry.metadata.name as string) ?? entry.slug,
        description: (entry.metadata.description as string) ?? "",
        content: entry.content,
        path: entry.path,
      };
    },
  });
}
