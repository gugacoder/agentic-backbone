import { resolveSkills } from "../context/resolver.js";
import type { Skill, SkillMetadata } from "./types.js";

export function parseSkillMetadata(
  raw: Record<string, unknown>
): SkillMetadata | undefined {
  const metaField = raw.metadata;
  if (!metaField || typeof metaField !== "string") return undefined;

  try {
    const parsed = JSON.parse(metaField);
    const ns = parsed.backbone ?? parsed.openclaw;
    if (!ns) return undefined;
    return ns as SkillMetadata;
  } catch {
    return undefined;
  }
}

export function loadAllSkills(agentId: string): Skill[] {
  const resolved = resolveSkills(agentId);
  const skills: Skill[] = [];

  for (const [, entry] of resolved) {
    const skillMeta = parseSkillMetadata(entry.metadata);
    skills.push({
      slug: entry.slug,
      name: (entry.metadata.name as string) ?? entry.slug,
      description: (entry.metadata.description as string) ?? "",
      enabled: (entry.metadata.enabled as boolean) ?? true,
      userInvocable: (entry.metadata["user-invocable"] as boolean) ?? undefined,
      trigger: (entry.metadata.trigger as string) ?? undefined,
      body: entry.content,
      source: entry.source,
      dir: entry.path.replace(/\/SKILL\.md$/, "").replace(/\\SKILL\.md$/, ""),
      metadata: skillMeta,
    });
  }

  return skills;
}
