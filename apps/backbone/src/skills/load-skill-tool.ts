import { tool } from "ai";
import { z } from "zod";
import type { Skill } from "./types.js";

/**
 * Creates a Vercel AI SDK tool that lets the agent load a skill's full content by name.
 * The skill data is pre-loaded — no filesystem access at runtime.
 */
export function createLoadSkillTool(skills: Skill[]) {
  // Index by name (lowercase) and by directory slug
  const byName = new Map<string, Skill>();
  for (const s of skills) {
    byName.set(s.name.toLowerCase(), s);
    // Also index by directory slug (last segment of dir path)
    const slug = s.dir.split(/[/\\]/).pop();
    if (slug && slug.toLowerCase() !== s.name.toLowerCase()) {
      byName.set(slug.toLowerCase(), s);
    }
  }

  const availableNames = skills.map((s) => s.name);

  return tool({
    description:
      "Load a skill's full instructions by name. Returns the complete SKILL.md content and directory path. Use this instead of reading skill files directly.",
    parameters: z.object({
      name: z.string().describe("Name of the skill to load"),
    }),
    execute: async ({ name }) => {
      const skill = byName.get(name.toLowerCase());
      if (!skill) {
        return `Skill "${name}" not found. Available skills: ${availableNames.join(", ")}`;
      }
      return {
        name: skill.name,
        description: skill.description,
        body: skill.body,
        dir: skill.dir,
      };
    },
  });
}
