import { tool } from "ai";
import { z } from "zod";
import { agentJournalDayPath } from "../../context/paths.js";
import { getAgentMemoryManager } from "../manager.js";
import { today, readFileSafe, ensureWrite } from "./_helpers.js";

export function createMemoryJournalTool(agentId: string): Record<string, any> {
  return {
    memory_journal: tool({
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

        let updated: string;
        if (existing) {
          updated = existing.trimEnd() + "\n\n" + args.content.trim() + "\n";
        } else {
          updated = `# Journal — ${day}\n\n${args.content.trim()}\n`;
        }

        ensureWrite(path, updated);

        try { getAgentMemoryManager(agentId).markDirty(); } catch {}

        return { saved: true, path };
      },
    }),
  };
}
