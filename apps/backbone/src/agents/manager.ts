import {
  existsSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  cpSync,
  readdirSync,
} from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { agentDir, agentConfigPath, agentTemplateDir } from "../context/paths.js";
import { readYamlAs, writeYamlAs, readContextFile } from "../context/readers.js";
import { AgentYmlSchema } from "../context/schemas.js";
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
  adapters?: string[];
}

// --- CRUD ---

/**
 * TODO: redesign as a migration process.
 *
 * The old updateAgent mutated AGENT.yml in place. Now that new agents are
 * created by cloning context/templates/agent, updating an agent means
 * reconciling the existing agent dir against an evolving template — i.e. a
 * migration, not a field patch. We don't yet have a plan for how to version
 * and apply those migrations, so this is intentionally a no-op: it returns
 * the current config unchanged and logs a warning. Callers still work but
 * their changes are not persisted until this is implemented.
 */
export function updateAgent(agentId: string, _updates: UpdateAgentInput): AgentConfig {
  const configPath = agentConfigPath(agentId);
  if (!existsSync(configPath)) {
    throw new Error(`Agent ${agentId} not found`);
  }
  console.warn(
    `[agents] updateAgent(${agentId}) is a no-op — migration-based update not yet implemented`
  );
  const current = getAgent(agentId);
  if (!current) {
    throw new Error(`Agent ${agentId} not found in registry`);
  }
  return current;
}

export function createAgent(input: CreateAgentInput): AgentConfig {
  const agentId = `${input.owner}.${input.slug}`;
  const dir = agentDir(agentId);

  if (existsSync(dir)) {
    throw new Error(`Agent ${agentId} already exists`);
  }

  // Clone the agent template (context/templates/agent) into the new agent dir.
  // This provides SOUL.md, HEARTBEAT.md, CONVERSATION.md, REQUEST.md, MEMORY.md,
  // KNOWLEDGE_BASE.md, README.md, AGENTS.md, kb/, .claude/, .systems/, etc.
  const tpl = agentTemplateDir();
  if (!existsSync(tpl)) {
    throw new Error(`Agent template not found: ${tpl}`);
  }
  cpSync(tpl, dir, { recursive: true });

  // Runtime-only dirs not part of the template.
  mkdirSync(join(dir, "conversations"), { recursive: true });
  mkdirSync(join(dir, "tasks"), { recursive: true });
  mkdirSync(join(dir, "skills"), { recursive: true });
  mkdirSync(join(dir, "services"), { recursive: true });

  const config: Record<string, unknown> = {
    id: agentId,
    owner: input.owner,
    slug: input.slug,
    delivery: input.delivery ?? "",
    enabled: input.enabled ?? false,
    "heartbeat-enabled": input.heartbeatEnabled ?? false,
    "heartbeat-interval": input.heartbeatInterval ?? 30000,
    description: input.description ?? "",
    ...input.metadata,
  };

  writeYamlAs(agentConfigPath(agentId), config, AgentYmlSchema);

  // Prepare the agent system: install npm deps under .systems/.
  const systemsDir = join(dir, ".systems");
  if (existsSync(join(systemsDir, "package.json"))) {
    try {
      console.log(`[agents] ${agentId}: running npm install in .systems/`);
      execSync("npm install", {
        cwd: systemsDir,
        stdio: "inherit",
      });
    } catch (err) {
      console.warn(`[agents] ${agentId}: npm install in .systems/ failed:`, err);
    }
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

  // Update the AGENT.yml with new identity
  const configPath = agentConfigPath(newId);
  const config = readYamlAs(configPath, AgentYmlSchema) as Record<string, unknown>;
  config.id = newId;
  config.owner = newOwner;
  config.slug = newSlug;
  writeYamlAs(configPath, config, AgentYmlSchema);

  refreshAgentRegistry();
  return getAgent(newId)!;
}

export function readAgentFile(agentId: string, filename: string): string | null {
  const filePath = join(agentDir(agentId), filename);
  if (!existsSync(filePath)) return null;
  return readContextFile(filePath);
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
