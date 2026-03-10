import { z } from "zod";
import type { ToolDefinition } from "../../agent/tool-defs.js";
import { loadAllSkills } from "../loader.js";

export function create(agentId: string): ToolDefinition {
  const skills = loadAllSkills(agentId);

  const byName = new Map<string, (typeof skills)[0]>();
  for (const s of skills) {
    byName.set(s.name.toLowerCase(), s);
    const slug = s.dir.split(/[/\\]/).pop();
    if (slug && slug.toLowerCase() !== s.name.toLowerCase()) {
      byName.set(slug.toLowerCase(), s);
    }
  }

  const availableNames = skills.map((s) => s.name);

  return {
    name: "load_skill",
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
  };
}
