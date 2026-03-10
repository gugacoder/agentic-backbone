import { z } from "zod";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ToolDefinition } from "../../agent/tool-defs.js";
import { userDir } from "../../context/paths.js";

export function create(_agentId: string): ToolDefinition {
  return {
    name: "memory_user_save",
    description:
      "Save learned facts about a user to their USER.md profile. " +
      "Use when you discover user preferences, context, or relevant information during interactions. " +
      "Duplicates are skipped automatically.",
    parameters: z.object({
      userSlug: z.string().describe("User slug (e.g. 'guga', 'cia')"),
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
        (f: string) => !existingLower.includes(f.toLowerCase())
      );

      if (newFacts.length === 0) {
        return { saved: true, path, factsCount: 0, note: "All facts already exist" };
      }

      const section = `\n${newFacts.map((f: string) => `- ${f}`).join("\n")}\n`;
      const updated = existing.trimEnd() + "\n" + section;
      writeFileSync(path, updated, "utf-8");

      return { saved: true, path, factsCount: newFacts.length };
    },
  };
}
