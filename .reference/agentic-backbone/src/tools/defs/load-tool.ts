import { z } from "zod";
import type { ToolDefinition } from "../../agent/tool-defs.js";
import { loadAgentTools } from "../loader.js";

export function create(agentId: string): ToolDefinition {
  const tools = loadAgentTools(agentId);

  const byName = new Map<string, (typeof tools)[0]>();
  for (const t of tools) {
    const name = (t.metadata.name as string) ?? t.slug;
    byName.set(name.toLowerCase(), t);
    if (t.slug.toLowerCase() !== name.toLowerCase()) {
      byName.set(t.slug.toLowerCase(), t);
    }
  }

  const availableNames = tools.map((t) => (t.metadata.name as string) ?? t.slug);

  return {
    name: "load_tool",
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
  };
}
