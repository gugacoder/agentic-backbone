import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Anchor on the monorepo root, NOT process.cwd(), so the path is stable
// regardless of which directory the process was launched from.
// process.cwd() is unreliable: npm workspace scripts run from apps/backbone/,
// but CONTEXT_FOLDER in .env is relative to the monorepo root.
// __dirname = apps/backbone/src/context/ → 4 levels up = monorepo root
const REPO_ROOT = resolve(__dirname, "../../../..");

if (!process.env.CONTEXT_FOLDER) {
  throw new Error("Missing required env var: CONTEXT_FOLDER");
}

export const CONTEXT_DIR = resolve(REPO_ROOT, process.env.CONTEXT_FOLDER);

export type ResourceKind = "skills" | "tools" | "adapters" | "connectors" | "services";

// --- Top-level directories ---

export function sharedDir(): string {
  return join(CONTEXT_DIR, "shared");
}

export function systemDir(): string {
  return join(CONTEXT_DIR, "system");
}

export function usersDir(): string {
  return join(CONTEXT_DIR, "users");
}

export function agentsDir(): string {
  return join(CONTEXT_DIR, "agents");
}

// --- Per-entity directories ---

export function userDir(slug: string): string {
  return join(usersDir(), slug);
}

export function channelDir(userSlug: string, channelSlug: string): string {
  return join(userDir(userSlug), "channels", channelSlug);
}

export function agentDir(agentId: string): string {
  return join(agentsDir(), agentId);
}

// --- Agent ID parsing ---

export function parseAgentId(agentId: string): {
  owner: string;
  slug: string;
} {
  const dotIndex = agentId.indexOf(".");
  if (dotIndex === -1) return { owner: "system", slug: agentId };
  return {
    owner: agentId.slice(0, dotIndex),
    slug: agentId.slice(dotIndex + 1),
  };
}

export function isSystemAgent(agentId: string): boolean {
  return parseAgentId(agentId).owner === "system";
}

// --- Agent-specific paths ---

export function agentSoulPath(agentId: string): string {
  return join(agentDir(agentId), "SOUL.md");
}

export function agentHeartbeatPath(agentId: string): string {
  return join(agentDir(agentId), "HEARTBEAT.md");
}

export function agentMemoryPath(agentId: string): string {
  return join(agentDir(agentId), "MEMORY.md");
}

export function agentJournalDayPath(agentId: string, day: string): string {
  return join(agentDir(agentId), "journal", day, "MEMORY.md");
}

export function agentConversationPath(agentId: string): string {
  return join(agentDir(agentId), "CONVERSATION.md");
}

export function agentRequestPath(agentId: string): string {
  return join(agentDir(agentId), "REQUEST.md");
}

export function agentConfigPath(agentId: string): string {
  return join(agentDir(agentId), "AGENT.md");
}

// --- Resource kind directories at each level ---

export function sharedResourceDir(kind: ResourceKind): string {
  return join(sharedDir(), kind);
}

export function systemResourceDir(kind: ResourceKind): string {
  return join(systemDir(), kind);
}

export function userResourceDir(userSlug: string, kind: ResourceKind): string {
  return join(userDir(userSlug), kind);
}

export function agentResourceDir(
  agentId: string,
  kind: ResourceKind
): string {
  return join(agentDir(agentId), kind);
}
