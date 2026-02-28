import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  cpSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import { agentDir, agentsDir, agentConfigPath } from "../context/paths.js";
import { parseFrontmatter, serializeFrontmatter } from "../context/frontmatter.js";
import { updateFrontmatter, writeFileAtomic } from "../context/frontmatter-writer.js";
import { refreshAgentRegistry, getAgent } from "./registry.js";
import type { AgentConfig } from "./types.js";

export interface CreateAgentInput {
  owner: string;
  slug: string;
  description?: string;
  delivery?: string;
  enabled?: boolean;
  heartbeatEnabled?: boolean;
  heartbeatInterval?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateAgentInput {
  description?: string;
  delivery?: string;
  enabled?: boolean;
  heartbeatEnabled?: boolean;
  heartbeatInterval?: number;
  metadata?: Record<string, unknown>;
}

export function createAgent(input: CreateAgentInput): AgentConfig {
  const agentId = `${input.owner}.${input.slug}`;
  const dir = agentDir(agentId);

  if (existsSync(dir)) {
    throw new Error(`Agent ${agentId} already exists`);
  }

  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, "conversations"), { recursive: true });
  mkdirSync(join(dir, "tasks"), { recursive: true });
  mkdirSync(join(dir, "skills"), { recursive: true });
  mkdirSync(join(dir, "tools"), { recursive: true });
  mkdirSync(join(dir, "services"), { recursive: true });

  const meta: Record<string, unknown> = {
    id: agentId,
    owner: input.owner,
    slug: input.slug,
    delivery: input.delivery ?? "",
    enabled: input.enabled ?? false,
    "heartbeat-enabled": input.heartbeatEnabled ?? false,
    "heartbeat-interval": input.heartbeatInterval ?? 30000,
    ...input.metadata,
  };

  const content = input.description ?? `# ${input.slug}\n`;
  const md = serializeFrontmatter(meta, content);
  writeFileSync(agentConfigPath(agentId), md);

  // Create default markdown files
  writeFileSync(join(dir, "SOUL.md"), `# ${input.slug} Soul\n\nDescribe this agent's identity and behavior.\n`);
  writeFileSync(join(dir, "HEARTBEAT.md"), `# Heartbeat Instructions\n\n- [ ] Add heartbeat tasks here\n`);
  writeFileSync(join(dir, "CONVERSATION.md"), `# Conversation Instructions\n`);
  writeFileSync(join(dir, "REQUEST.md"), `# Request Instructions\n`);

  refreshAgentRegistry();
  return getAgent(agentId)!;
}

export function updateAgent(agentId: string, updates: UpdateAgentInput): AgentConfig {
  const configPath = agentConfigPath(agentId);
  if (!existsSync(configPath)) {
    throw new Error(`Agent ${agentId} not found`);
  }

  // Build frontmatter updates
  const fmUpdates: Record<string, unknown> = {};
  if (updates.delivery !== undefined) fmUpdates.delivery = updates.delivery;
  if (updates.enabled !== undefined) fmUpdates.enabled = updates.enabled;
  if (updates.heartbeatEnabled !== undefined) fmUpdates["heartbeat-enabled"] = updates.heartbeatEnabled;
  if (updates.heartbeatInterval !== undefined) fmUpdates["heartbeat-interval"] = updates.heartbeatInterval;
  if (updates.metadata) {
    for (const [key, value] of Object.entries(updates.metadata)) {
      fmUpdates[key] = value;
    }
  }

  // Handle description (body content) change — requires full rewrite
  if (updates.description !== undefined) {
    const raw = readFileSync(configPath, "utf-8");
    const { metadata } = parseFrontmatter(raw);
    Object.assign(metadata, fmUpdates);
    writeFileAtomic(configPath, serializeFrontmatter(metadata, updates.description));
  } else if (Object.keys(fmUpdates).length > 0) {
    updateFrontmatter(configPath, fmUpdates);
  }

  refreshAgentRegistry();
  return getAgent(agentId)!;
}

export function deleteAgent(agentId: string): boolean {
  const dir = agentDir(agentId);
  if (!existsSync(dir)) return false;

  rmSync(dir, { recursive: true, force: true });
  refreshAgentRegistry();
  return true;
}

export function duplicateAgent(
  sourceAgentId: string,
  newOwner: string,
  newSlug: string
): AgentConfig {
  const sourceDir = agentDir(sourceAgentId);
  if (!existsSync(sourceDir)) {
    throw new Error(`Source agent ${sourceAgentId} not found`);
  }

  const newId = `${newOwner}.${newSlug}`;
  const destDir = agentDir(newId);
  if (existsSync(destDir)) {
    throw new Error(`Agent ${newId} already exists`);
  }

  cpSync(sourceDir, destDir, { recursive: true });

  // Update the AGENT.md with new identity
  const configPath = agentConfigPath(newId);
  const raw = readFileSync(configPath, "utf-8");
  const { metadata, content } = parseFrontmatter(raw);
  metadata.id = newId;
  metadata.owner = newOwner;
  metadata.slug = newSlug;
  writeFileSync(configPath, serializeFrontmatter(metadata, content));

  refreshAgentRegistry();
  return getAgent(newId)!;
}

export function readAgentFile(agentId: string, filename: string): string | null {
  const filePath = join(agentDir(agentId), filename);
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, "utf-8");
}

export function writeAgentFile(agentId: string, filename: string, content: string): void {
  const dir = agentDir(agentId);
  if (!existsSync(dir)) {
    throw new Error(`Agent ${agentId} not found`);
  }
  writeFileSync(join(dir, filename), content);
}

export function listAgentFiles(agentId: string): string[] {
  const dir = agentDir(agentId);
  if (!existsSync(dir)) return [];

  const files: string[] = [];
  function walk(d: string, prefix: string): void {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(join(d, entry.name), rel);
      } else {
        files.push(rel);
      }
    }
  }
  walk(dir, "");
  return files;
}
