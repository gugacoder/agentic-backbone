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
import { ServiceMdSchema } from "../context/schemas.js";
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
  if (scope === "system") return userResourceDir("system", KIND);
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

  const metaRaw = {
    name: input.name,
    description: input.description ?? "",
    "skip-agent": input.skipAgent ?? false,
    enabled: true,
    ...input.metadata,
  };

  const meta = ServiceMdSchema.parse(metaRaw);
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

  const patch: Record<string, unknown> = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.skipAgent !== undefined) patch["skip-agent"] = updates.skipAgent;
  if (updates.metadata) Object.assign(patch, updates.metadata);

  const { metadata, content } = patchMarkdownAs(mdPath, patch, ServiceMdSchema, updates.body);

  return {
    slug,
    path: mdPath,
    source: scope,
    metadata: metadata as Record<string, unknown>,
    content,
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
  const { metadata, content } = readMarkdownAs(mdPath, ServiceMdSchema);

  return {
    slug,
    path: mdPath,
    source: `agent:${agentId}`,
    metadata: metadata as Record<string, unknown>,
    content,
  };
}

export function listAllServicesGlobally(): ResolvedResource[] {
  return [...resolveServices("system.main").values()];
}
