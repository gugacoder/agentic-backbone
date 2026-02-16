import { loadAllSkills } from "./loader.js";
import { filterEligibleSkills } from "./eligibility.js";
import type { Skill, SkillsSnapshot } from "./types.js";

export function formatSkillsPrompt(skills: Skill[]): string {
  if (skills.length === 0) return "";

  let prompt = "<available_skills>\n";
  for (const s of skills) {
    prompt += `- **${s.name}**: ${s.description}\n`;
  }
  prompt += "</available_skills>\n";
  prompt +=
    "If exactly one skill clearly applies, read its SKILL.md from the context directory, then follow it. Never read more than one skill up front.\n\n";
  return prompt;
}

export function buildSkillsSnapshot(agentId: string): SkillsSnapshot {
  const all = loadAllSkills(agentId);
  const eligible = filterEligibleSkills(all);
  const prompt = formatSkillsPrompt(eligible);
  return { skills: eligible, prompt };
}
