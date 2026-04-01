import {
  existsSync,
  mkdirSync,
  rmSync,
  cpSync,
} from "node:fs";
import { join } from "node:path";
import {
  sharedResourceDir,
  userResourceDir,
  agentResourceDir,
  type ResourceKind,
} from "../context/paths.js";
import {
  readMarkdownAs,
  writeMarkdown,
  patchMarkdownAs,
} from "../context/readers.js";
import { SkillMdSchema } from "../context/schemas.js";
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
  if (scope === "system") return userResourceDir("system", KIND);
  return agentResourceDir(scope, KIND);
}

export function createSkill(input: CreateSkillInput): ResolvedResource {
  const skillDir = join(resolveDir(input.scope), input.slug);
  const mdPath = join(skillDir, FILENAME);

  if (existsSync(mdPath)) {
    throw new Error(`Skill ${input.slug} already exists in scope ${input.scope}`);
  }

  mkdirSync(skillDir, { recursive: true });

  const metaRaw = {
    name: input.name,
    description: input.description ?? "",
    ...input.metadata,
  };

  const meta = SkillMdSchema.parse(metaRaw);
  const body = input.body ?? `# ${input.name}\n`;
  writeMarkdown(mdPath, meta as Record<string, unknown>, body);

  return {
    slug: input.slug,
    path: mdPath,
    source: input.scope,
    metadata: meta as Record<string, unknown>,
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

  const patch: Record<string, unknown> = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.metadata) Object.assign(patch, updates.metadata);

  const { metadata, content } = patchMarkdownAs(mdPath, patch, SkillMdSchema, updates.body);

  return {
    slug,
    path: mdPath,
    source: scope,
    metadata: metadata as Record<string, unknown>,
    content,
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
  const { metadata, content } = readMarkdownAs(mdPath, SkillMdSchema);

  return {
    slug,
    path: mdPath,
    source: `agent:${agentId}`,
    metadata: metadata as Record<string, unknown>,
    content,
  };
}

export function listAllSkillsGlobally(): ResolvedResource[] {
  // Resolve for system.main to get shared + system skills
  const systemSkills = [...resolveSkills("system.main").values()];
  return systemSkills;
}
