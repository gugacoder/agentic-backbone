import { tool } from "ai";
import { z } from "zod";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { agentUserMemoryPath } from "../../context/paths.js";
import { getAgentMemoryManager } from "../manager.js";

export function createMemoryUserSaveTool(agentId: string): Record<string, any> {
  return {
    memory_user_save: tool({
      description:
        "Save learned facts about a user to your private memory about them. " +
        "Use when you discover user preferences, context, or relevant information during interactions. " +
        "Duplicates are skipped automatically.",
      parameters: z.object({
        userSlug: z
          .string()
          .describe("User slug (e.g. 'guga', 'admin')"),
        facts: z
          .array(z.string())
          .min(1)
          .describe("Facts to record about the user. Each should be concise and objective."),
      }),
      execute: async (args) => {
        const path = agentUserMemoryPath(agentId, args.userSlug);

        const dir = dirname(path);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }

        const existing = existsSync(path) ? readFileSync(path, "utf-8") : "";
        const existingLower = existing.toLowerCase();

        const newFacts = args.facts.filter(
          (f) => !existingLower.includes(f.toLowerCase())
        );

        if (newFacts.length === 0) {
          return { saved: true, path, factsCount: 0, note: "All facts already exist" };
        }

        const section = `\n${newFacts.map((f) => `- ${f}`).join("\n")}\n`;
        const updated = existing ? existing.trimEnd() + "\n" + section : `# ${args.userSlug}\n` + section;
        writeFileSync(path, updated, "utf-8");

        try { getAgentMemoryManager(agentId).markDirty(); } catch {}

        return { saved: true, path, factsCount: newFacts.length };
      },
    }),
  };
}
