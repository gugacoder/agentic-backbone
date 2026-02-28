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
import {
  parseFrontmatter,
  serializeFrontmatter,
} from "../context/frontmatter.js";
import { resolveServices, type ResolvedResource } from "../context/resolver.js";

const KIND: ResourceKind = "services";
const FILENAME = "SERVICE.md";

export interface CreateServiceInput {
  slug: string;
  scope: "shared" | "system" | string; // string = agentId
  name: string;
  description?: string;
  skipAgent?: boolean;
  body?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateServiceInput {
  name?: string;
  description?: string;
  skipAgent?: boolean;
  body?: string;
  metadata?: Record<string, unknown>;
}

function resolveDir(scope: string): string {
  if (scope === "shared") return sharedResourceDir(KIND);
  if (scope === "system") return systemResourceDir(KIND);
  return agentResourceDir(scope, KIND);
}

export function createService(input: CreateServiceInput): ResolvedResource {
  const serviceDir = join(resolveDir(input.scope), input.slug);
  const mdPath = join(serviceDir, FILENAME);

  if (existsSync(mdPath)) {
    throw new Error(
      `Service ${input.slug} already exists in scope ${input.scope}`
    );
  }

  mkdirSync(serviceDir, { recursive: true });

  const meta: Record<string, unknown> = {
    name: input.name,
    description: input.description ?? "",
    "skip-agent": input.skipAgent ?? false,
    enabled: true,
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

export function updateService(
  scope: string,
  slug: string,
  updates: UpdateServiceInput
): ResolvedResource {
  const serviceDir = join(resolveDir(scope), slug);
  const mdPath = join(serviceDir, FILENAME);

  if (!existsSync(mdPath)) {
    throw new Error(`Service ${slug} not found in scope ${scope}`);
  }

  const raw = readFileSync(mdPath, "utf-8");
  const { metadata, content } = parseFrontmatter(raw);

  if (updates.name !== undefined) metadata.name = updates.name;
  if (updates.description !== undefined)
    metadata.description = updates.description;
  if (updates.skipAgent !== undefined)
    metadata["skip-agent"] = updates.skipAgent;
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

export function deleteService(scope: string, slug: string): boolean {
  const serviceDir = join(resolveDir(scope), slug);
  if (!existsSync(serviceDir)) return false;

  rmSync(serviceDir, { recursive: true, force: true });
  return true;
}

export function assignServiceToAgent(
  sourceScope: string,
  slug: string,
  agentId: string
): ResolvedResource {
  const sourceDir = join(resolveDir(sourceScope), slug);
  if (!existsSync(sourceDir)) {
    throw new Error(`Service ${slug} not found in scope ${sourceScope}`);
  }

  const destDir = join(agentResourceDir(agentId, KIND), slug);
  if (existsSync(destDir)) {
    throw new Error(`Service ${slug} already exists for agent ${agentId}`);
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

export function listAllServicesGlobally(): ResolvedResource[] {
  return [...resolveServices("system.main").values()];
}
