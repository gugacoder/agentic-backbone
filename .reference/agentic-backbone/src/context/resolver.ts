import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { loadMetadata } from "./metadata-loader.js";
import {
  type ResourceKind,
  sharedResourceDir,
  systemResourceDir,
  agentResourceDir,
  parseAgentId,
  userResourceDir,
  agentSoulPath,
  systemDir,
  agentHeartbeatPath,
  agentConversationPath,
  agentRequestPath,
  CONTEXT_DIR,
} from "./paths.js";
import { getBuiltinAdaptersAsResolved, getBuiltinDef } from "../adapters/builtin.js";

// --- Types ---

export interface ResolvedResource {
  slug: string;
  path: string;
  source: string;
  metadata: Record<string, unknown>;
  content: string;
}

// --- Scanning ---

function scanResourceDir(
  dir: string,
  basename: string,
  source: string
): ResolvedResource[] {
  if (!existsSync(dir)) return [];

  const entries: ResolvedResource[] = [];
  for (const slug of readdirSync(dir)) {
    const result = loadMetadata(join(dir, slug), basename);
    if (!result) continue;
    entries.push({ slug, path: result.filePath, source, metadata: result.data, content: result.content });
  }
  return entries;
}

// --- Precedence chain ---

function getResourceDirs(
  agentId: string,
  kind: ResourceKind
): { dir: string; source: string }[] {
  const { owner } = parseAgentId(agentId);
  const dirs: { dir: string; source: string }[] = [
    { dir: sharedResourceDir(kind), source: "shared" },
  ];

  if (owner === "system") {
    dirs.push({ dir: systemResourceDir(kind), source: "system" });
  } else {
    dirs.push({ dir: userResourceDir(owner, kind), source: `user:${owner}` });
  }

  dirs.push({
    dir: agentResourceDir(agentId, kind),
    source: `agent:${agentId}`,
  });

  return dirs;
}

export function resolveResources(
  agentId: string,
  kind: ResourceKind,
  filename: string
): Map<string, ResolvedResource> {
  const result = new Map<string, ResolvedResource>();
  for (const { dir, source } of getResourceDirs(agentId, kind)) {
    for (const entry of scanResourceDir(dir, filename, source)) {
      result.set(entry.slug, entry); // last wins (higher precedence)
    }
  }
  return result;
}

// --- Convenience resolvers ---

export function resolveSkills(
  agentId: string
): Map<string, ResolvedResource> {
  return resolveResources(agentId, "skills", "SKILL");
}

export function resolveTools(
  agentId: string
): Map<string, ResolvedResource> {
  return resolveResources(agentId, "tools", "TOOL");
}

export function resolveAdapters(
  agentId: string
): Map<string, ResolvedResource> {
  // Built-ins first (lowest precedence), then YAML overwrites if same slug
  const result = getBuiltinAdaptersAsResolved();
  const yamlAdapters = resolveResources(agentId, "adapters", "ADAPTER");
  for (const [slug, resource] of yamlAdapters) {
    result.set(slug, resource);
  }
  return result;
}

// --- Direct adapter lookup (no agent context needed) ---

export function findAdapter(slug: string): ResolvedResource | null {
  const filename = "ADAPTER.yaml";

  // Search YAML first: shared → system
  for (const dir of [sharedResourceDir("adapters"), systemResourceDir("adapters")]) {
    const yamlPath = join(dir, slug, filename);
    if (!existsSync(yamlPath)) continue;
    const raw = readFileSync(yamlPath, "utf-8");
    const parsed = yaml.load(raw);
    const metadata = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
    return { slug, path: yamlPath, source: "shared", metadata, content: raw };
  }

  // Fallback to built-in
  const def = getBuiltinDef(slug);
  if (def) {
    return {
      slug: def.slug,
      path: "",
      source: "builtin",
      metadata: {
        name: def.name,
        connector: def.connector,
        policy: def.policy,
        description: def.description,
      },
      content: "",
    };
  }

  return null;
}

// --- Soul resolution (agent → system fallback) ---

export function resolveAgentSoul(agentId: string): string {
  const agentPath = agentSoulPath(agentId);
  if (existsSync(agentPath)) {
    return readFileSync(agentPath, "utf-8");
  }
  const systemPath = join(systemDir(), "SOUL.md");
  if (existsSync(systemPath)) {
    return readFileSync(systemPath, "utf-8");
  }
  return "";
}

// --- Heartbeat instructions ---

export function resolveHeartbeatInstructions(agentId: string): string {
  const path = agentHeartbeatPath(agentId);
  return existsSync(path) ? readFileSync(path, "utf-8") : "";
}

// --- Conversation instructions ---

export function resolveConversationInstructions(agentId: string): string {
  const path = agentConversationPath(agentId);
  return existsSync(path) ? readFileSync(path, "utf-8") : "";
}

// --- Request instructions ---

const DEFAULT_REQUEST_INSTRUCTIONS = `Voce foi acionado para atender um pedido especifico.
Seja direto, objetivo e deterministico.
Nao faca perguntas. Nao converse.
Execute o que foi pedido e responda com o resultado.`;

export function resolveRequestInstructions(agentId: string): string {
  const path = agentRequestPath(agentId);
  return existsSync(path) ? readFileSync(path, "utf-8") : DEFAULT_REQUEST_INSTRUCTIONS;
}

// --- Agent service config resolution ---

export function resolveAgentServiceConfig(
  agentId: string,
  serviceSlug: string
): Record<string, unknown> | null {
  // Search order: agent-specific → shared
  const dirs = [
    join(agentResourceDir(agentId, "services"), serviceSlug),
    join(sharedResourceDir("services"), serviceSlug),
  ];
  for (const dir of dirs) {
    const result = loadMetadata(dir, "SERVICE");
    if (result) return result.data;
  }
  return null;
}
