import { z } from "zod";
import type { ToolDefinition } from "../../agent/tool-defs.js";
import { agentJournalDayPath } from "../../context/paths.js";
import { getAgentMemoryManager } from "../manager.js";
import { today, readFileSafe, ensureWrite } from "../_utils.js";

export function create(agentId: string): ToolDefinition {
  return {
    name: "memory_journal",
    description:
      "Write a journal entry for today. Journals capture detailed context, reflections, and narratives " +
      "that are too verbose for MEMORY.md. Content is appended to the day's journal file.",
    parameters: z.object({
      content: z
        .string()
        .describe("Journal content in markdown. Can include sections, bullets, narrative text."),
    }),
    execute: async (args) => {
      const day = today();
      const path = agentJournalDayPath(agentId, day);
      const existing = readFileSafe(path);

      const updated = existing
        ? existing.trimEnd() + "\n\n" + args.content.trim() + "\n"
        : `# Journal — ${day}\n\n${args.content.trim()}\n`;

      ensureWrite(path, updated);

      try { getAgentMemoryManager(agentId).markDirty(); } catch {}

      return { saved: true, path };
    },
  };
}
