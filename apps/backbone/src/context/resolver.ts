import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { parseFrontmatter } from "./frontmatter.js";
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
} from "./paths.js";

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
  filename: string,
  source: string
): ResolvedResource[] {
  if (!existsSync(dir)) return [];

  const entries: ResolvedResource[] = [];
  for (const slug of readdirSync(dir)) {
    const mdPath = join(dir, slug, filename);
    if (!existsSync(mdPath)) continue;
    const raw = readFileSync(mdPath, "utf-8");
    const { metadata, content } = parseFrontmatter(raw);
    entries.push({ slug, path: mdPath, source, metadata, content });
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

// --- YAML resource scanning (for ADAPTER.yaml) ---

function scanYamlResourceDir(
  dir: string,
  filename: string,
  source: string
): ResolvedResource[] {
  if (!existsSync(dir)) return [];

  const entries: ResolvedResource[] = [];
  for (const slug of readdirSync(dir)) {
    const yamlPath = join(dir, slug, filename);
    if (!existsSync(yamlPath)) continue;
    const raw = readFileSync(yamlPath, "utf-8");
    const parsed = yaml.load(raw);
    const metadata = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
    entries.push({ slug, path: yamlPath, source, metadata, content: raw });
  }
  return entries;
}

function resolveYamlResources(
  agentId: string,
  kind: ResourceKind,
  filename: string
): Map<string, ResolvedResource> {
  const result = new Map<string, ResolvedResource>();
  for (const { dir, source } of getResourceDirs(agentId, kind)) {
    for (const entry of scanYamlResourceDir(dir, filename, source)) {
      result.set(entry.slug, entry);
    }
  }
  return result;
}

// --- Convenience resolvers ---

export function resolveSkills(
  agentId: string
): Map<string, ResolvedResource> {
  return resolveResources(agentId, "skills", "SKILL.md");
}

export function resolveTools(
  agentId: string
): Map<string, ResolvedResource> {
  return resolveResources(agentId, "tools", "TOOL.md");
}

export function resolveAdapters(
  agentId: string
): Map<string, ResolvedResource> {
  return resolveYamlResources(agentId, "adapters", "ADAPTER.yaml");
}

// --- Connector resolution ---

export function resolveConnectorDir(connectorSlug: string): string | null {
  // Search precedence: shared → system
  const shared = join(sharedResourceDir("connectors"), connectorSlug);
  if (existsSync(shared)) return shared;

  const system = join(systemResourceDir("connectors"), connectorSlug);
  if (existsSync(system)) return system;

  return null;
}

// --- Direct adapter lookup (no agent context needed) ---

export function findAdapter(slug: string): ResolvedResource | null {
  const filename = "ADAPTER.yaml";

  // Search: shared → system (covers all non-agent adapters)
  for (const dir of [sharedResourceDir("adapters"), systemResourceDir("adapters")]) {
    const yamlPath = join(dir, slug, filename);
    if (!existsSync(yamlPath)) continue;
    const raw = readFileSync(yamlPath, "utf-8");
    const parsed = yaml.load(raw);
    const metadata = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
    return { slug, path: yamlPath, source: "shared", metadata, content: raw };
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
