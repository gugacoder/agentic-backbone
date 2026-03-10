import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  cpSync,
} from "node:fs";
import { join } from "node:path";
import {
  sharedResourceDir,
  systemResourceDir,
  agentResourceDir,
  type ResourceKind,
} from "../context/paths.js";
import { parseFrontmatter, serializeFrontmatter } from "../context/frontmatter.js";
import { resolveSkills, type ResolvedResource } from "../context/resolver.js";

const KIND: ResourceKind = "skills";
const FILENAME = "SKILL.md";

export interface CreateSkillInput {
  slug: string;
  scope: "shared" | "system" | string; // string = agentId
  name: string;
  description?: string;
  body?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateSkillInput {
  name?: string;
  description?: string;
  body?: string;
  metadata?: Record<string, unknown>;
}

function resolveDir(scope: string): string {
  if (scope === "shared") return sharedResourceDir(KIND);
  if (scope === "system") return systemResourceDir(KIND);
  return agentResourceDir(scope, KIND);
}

export function createSkill(input: CreateSkillInput): ResolvedResource {
  const skillDir = join(resolveDir(input.scope), input.slug);
  const mdPath = join(skillDir, FILENAME);

  if (existsSync(mdPath)) {
    throw new Error(`Skill ${input.slug} already exists in scope ${input.scope}`);
  }

  mkdirSync(skillDir, { recursive: true });

  const meta: Record<string, unknown> = {
    name: input.name,
    description: input.description ?? "",
    ...input.metadata,
  };

  const body = input.body ?? `# ${input.name}\n`;
  writeFileSync(mdPath, serializeFrontmatter(meta, body));

  return {
    slug: input.slug,
    path: mdPath,
    source: input.scope,
    metadata: meta,
    content: body,
  };
}

export function updateSkill(
  scope: string,
  slug: string,
  updates: UpdateSkillInput
): ResolvedResource {
  const skillDir = join(resolveDir(scope), slug);
  const mdPath = join(skillDir, FILENAME);

  if (!existsSync(mdPath)) {
    throw new Error(`Skill ${slug} not found in scope ${scope}`);
  }

  const raw = readFileSync(mdPath, "utf-8");
  const { metadata, content } = parseFrontmatter(raw);

  if (updates.name !== undefined) metadata.name = updates.name;
  if (updates.description !== undefined) metadata.description = updates.description;
  if (updates.metadata) {
    for (const [key, value] of Object.entries(updates.metadata)) {
      metadata[key] = value;
    }
  }

  const newContent = updates.body !== undefined ? updates.body : content;
  writeFileSync(mdPath, serializeFrontmatter(metadata, newContent));

  return {
    slug,
    path: mdPath,
    source: scope,
    metadata,
    content: newContent,
  };
}

export function deleteSkill(scope: string, slug: string): boolean {
  const skillDir = join(resolveDir(scope), slug);
  if (!existsSync(skillDir)) return false;

  rmSync(skillDir, { recursive: true, force: true });
  return true;
}

export function assignSkillToAgent(
  sourceScope: string,
  slug: string,
  agentId: string
): ResolvedResource {
  const sourceDir = join(resolveDir(sourceScope), slug);
  if (!existsSync(sourceDir)) {
    throw new Error(`Skill ${slug} not found in scope ${sourceScope}`);
  }

  const destDir = join(agentResourceDir(agentId, KIND), slug);
  if (existsSync(destDir)) {
    throw new Error(`Skill ${slug} already exists for agent ${agentId}`);
  }

  cpSync(sourceDir, destDir, { recursive: true });

  const mdPath = join(destDir, FILENAME);
  const raw = readFileSync(mdPath, "utf-8");
  const { metadata, content } = parseFrontmatter(raw);

  return {
    slug,
    path: mdPath,
    source: `agent:${agentId}`,
    metadata,
    content,
  };
}

export function listAllSkillsGlobally(): ResolvedResource[] {
  // Resolve for system.main to get shared + system skills
  const systemSkills = [...resolveSkills("system.main").values()];
  return systemSkills;
}
