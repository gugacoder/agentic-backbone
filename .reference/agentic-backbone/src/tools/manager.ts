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
import { resolveTools, type ResolvedResource } from "../context/resolver.js";

const KIND: ResourceKind = "tools";
const FILENAME = "TOOL.md";

export interface CreateToolInput {
  slug: string;
  scope: "shared" | "system" | string; // string = agentId
  name: string;
  description?: string;
  body?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateToolInput {
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

export function createTool(input: CreateToolInput): ResolvedResource {
  const toolDir = join(resolveDir(input.scope), input.slug);
  const mdPath = join(toolDir, FILENAME);

  if (existsSync(mdPath)) {
    throw new Error(`Tool ${input.slug} already exists in scope ${input.scope}`);
  }

  mkdirSync(toolDir, { recursive: true });

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

export function updateTool(
  scope: string,
  slug: string,
  updates: UpdateToolInput
): ResolvedResource {
  const toolDir = join(resolveDir(scope), slug);
  const mdPath = join(toolDir, FILENAME);

  if (!existsSync(mdPath)) {
    throw new Error(`Tool ${slug} not found in scope ${scope}`);
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

export function deleteTool(scope: string, slug: string): boolean {
  const toolDir = join(resolveDir(scope), slug);
  if (!existsSync(toolDir)) return false;

  rmSync(toolDir, { recursive: true, force: true });
  return true;
}

export function assignToolToAgent(
  sourceScope: string,
  slug: string,
  agentId: string
): ResolvedResource {
  const sourceDir = join(resolveDir(sourceScope), slug);
  if (!existsSync(sourceDir)) {
    throw new Error(`Tool ${slug} not found in scope ${sourceScope}`);
  }

  const destDir = join(agentResourceDir(agentId, KIND), slug);
  if (existsSync(destDir)) {
    throw new Error(`Tool ${slug} already exists for agent ${agentId}`);
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

export function listAllToolsGlobally(): ResolvedResource[] {
  return [...resolveTools("system.main").values()];
}
