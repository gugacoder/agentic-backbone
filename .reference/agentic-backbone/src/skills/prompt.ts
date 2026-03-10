import { join } from "node:path";
import { loadAllSkills } from "./loader.js";
import { filterEligibleSkills } from "./eligibility.js";
import type { Skill, SkillsSnapshot } from "./types.js";

export function formatSkillsPrompt(skills: Skill[]): string {
  if (skills.length === 0) return "";

  // Separate inline skills (always: true) from on-demand skills
  const inline: Skill[] = [];
  const onDemand: Skill[] = [];
  for (const s of skills) {
    if (s.metadata?.always) {
      inline.push(s);
    } else {
      onDemand.push(s);
    }
  }

  let prompt = "";

  // Inline skills: body embedded directly in the prompt
  for (const s of inline) {
    prompt += `<skill name="${s.name}">\n${s.body}\n</skill>\n\n`;
  }

  // On-demand skills: listed with path for the model to Read when needed
  if (onDemand.length > 0) {
    prompt += "<available_skills>\n";
    for (const s of onDemand) {
      const path = join(s.dir, "SKILL.md");
      prompt += `- **${s.name}**: ${s.description}\n  path: ${path}\n`;
    }
    prompt += "</available_skills>\n";
    prompt +=
      "If exactly one skill clearly applies, read its SKILL.md using the path above, then follow it. Never read more than one skill up front.\n\n";
  }

  return prompt;
}

export function buildSkillsSnapshot(agentId: string): SkillsSnapshot {
  const all = loadAllSkills(agentId);
  const eligible = filterEligibleSkills(all);
  const prompt = formatSkillsPrompt(eligible);
  return { skills: eligible, prompt };
}
