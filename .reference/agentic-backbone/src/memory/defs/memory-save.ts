import { z } from "zod";
import type { ToolDefinition } from "../../agent/tool-defs.js";
import { agentMemoryPath } from "../../context/paths.js";
import { getAgentMemoryManager } from "../manager.js";
import { today, readFileSafe, ensureWrite } from "../_utils.js";

export function create(agentId: string): ToolDefinition {
  return {
    name: "memory_save",
    description:
      "Save important facts, decisions, or learnings to the agent's long-term memory (MEMORY.md). " +
      "Facts are appended as a dated section. Duplicates are skipped automatically.",
    parameters: z.object({
      facts: z
        .array(z.string())
        .min(1)
        .describe("List of facts to save. Each fact should be a concise, self-contained statement."),
    }),
    execute: async (args) => {
      const path = agentMemoryPath(agentId);
      const existing = readFileSafe(path);
      const existingLower = existing.toLowerCase();

      const newFacts = args.facts.filter(
        (f: string) => !existingLower.includes(f.toLowerCase())
      );

      if (newFacts.length === 0) {
        return { saved: true, path, factsCount: 0, note: "All facts already exist" };
      }

      const day = today();
      const section = `\n## ${day}\n\n${newFacts.map((f: string) => `- ${f}`).join("\n")}\n`;
      const updated = existing.trimEnd() + "\n" + section;
      ensureWrite(path, updated);

      try { getAgentMemoryManager(agentId).markDirty(); } catch {}

      return { saved: true, path, factsCount: newFacts.length };
    },
  };
}
