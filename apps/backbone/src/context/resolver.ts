import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter, readContextFile } from "./readers.js";
import {
  type ResourceKind,
  sharedResourceDir,
  agentResourceDir,
  parseAgentId,
  userResourceDir,
  agentSoulPath,
  userMdPath,
  agentHeartbeatPath,
  agentConversationPath,
  agentRequestPath,
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
    const raw = readContextFile(mdPath);
    const { metadata, content } = parseFrontmatter(raw);
    entries.push({ slug, path: mdPath, source, metadata, content });
  }
  return entries;
}

// --- Precedence chain ---

export function getResourceDirs(
  agentId: string,
  kind: ResourceKind
): { dir: string; source: string }[] {
  const { owner } = parseAgentId(agentId);
  return [
    { dir: sharedResourceDir(kind), source: "shared" },
    { dir: userResourceDir(owner, kind), source: `user:${owner}` },
    { dir: agentResourceDir(agentId, kind), source: `agent:${agentId}` },
  ];
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
  return resolveResources(agentId, "skills", "SKILL.md");
}

// --- Soul resolution (agent-specific only, no fallback) ---

export function resolveAgentSoul(agentId: string): string {
  const agentPath = agentSoulPath(agentId);
  if (existsSync(agentPath)) return readContextFile(agentPath);
  return "";
}

// --- Interaction mode ---

export type InteractionMode = "heartbeat" | "conversation" | "request";

const MODE_PATH: Record<InteractionMode, (agentId: string) => string> = {
  heartbeat: agentHeartbeatPath,
  conversation: agentConversationPath,
  request: agentRequestPath,
};

export function resolveModeInstructions(
  agentId: string,
  mode: InteractionMode
): string {
  const pathFn = MODE_PATH[mode];
  const path = pathFn(agentId);
  return existsSync(path) ? readContextFile(path) : "";
}

// --- User/mentor profile (agent-specific → owner fallback, merged) ---

export function resolveUserProfile(agentId: string): string {
  const { owner } = parseAgentId(agentId);
  if (owner === "system") return "";

  const mdPath = userMdPath(owner);
  if (!existsSync(mdPath)) return "";

  return readContextFile(mdPath);
}

// --- Services ---

export function resolveServices(
  agentId: string
): Map<string, ResolvedResource> {
  return resolveResources(agentId, "services", "SERVICE.md");
}
