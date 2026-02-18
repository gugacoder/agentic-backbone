import { tool } from "ai";
import { z } from "zod";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  agentMemoryPath,
  agentJournalDayPath,
  userDir,
} from "../context/paths.js";
import { getAgentMemoryManager } from "./manager.js";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function readFileSafe(path: string): string {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return "";
  }
}

function ensureWrite(path: string, content: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, content, "utf-8");
}

/**
 * Creates Vercel AI SDK tools for memory operations.
 * Replaces the old instruction-based memory skills with native 1-round-trip tools.
 */
export function createMemoryKaiTools(agentId: string): Record<string, any> {
  return {
    memory_save: tool({
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

        // Filter duplicates
        const newFacts = args.facts.filter(
          (f) => !existingLower.includes(f.toLowerCase())
        );

        if (newFacts.length === 0) {
          return { saved: true, path, factsCount: 0, note: "All facts already exist" };
        }

        const day = today();
        const section = `\n## ${day}\n\n${newFacts.map((f) => `- ${f}`).join("\n")}\n`;
        const updated = existing.trimEnd() + "\n" + section;
        ensureWrite(path, updated);

        // Ensure next search re-indexes the updated content
        try { getAgentMemoryManager(agentId).markDirty(); } catch {}

        return { saved: true, path, factsCount: newFacts.length };
      },
    }),

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

        // Ensure next search re-indexes the updated content
        try { getAgentMemoryManager(agentId).markDirty(); } catch {}

        return { saved: true, path };
      },
    }),

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

    memory_user_save: tool({
      description:
        "Save learned facts about a user to their USER.md profile. " +
        "Use when you discover user preferences, context, or relevant information during interactions. " +
        "Duplicates are skipped automatically.",
      parameters: z.object({
        userSlug: z
          .string()
          .describe("User slug (e.g. 'guga', 'cia')"),
        facts: z
          .array(z.string())
          .min(1)
          .describe("Facts to record about the user. Each should be concise and objective."),
      }),
      execute: async (args) => {
        const path = join(userDir(args.userSlug), "USER.md");

        if (!existsSync(path)) {
          return { saved: false, error: `User '${args.userSlug}' not found` };
        }

        const existing = readFileSync(path, "utf-8");
        const existingLower = existing.toLowerCase();

        const newFacts = args.facts.filter(
          (f) => !existingLower.includes(f.toLowerCase())
        );

        if (newFacts.length === 0) {
          return { saved: true, path, factsCount: 0, note: "All facts already exist" };
        }

        const section = `\n${newFacts.map((f) => `- ${f}`).join("\n")}\n`;
        const updated = existing.trimEnd() + "\n" + section;
        writeFileSync(path, updated, "utf-8");

        return { saved: true, path, factsCount: newFacts.length };
      },
    }),
  };
}
