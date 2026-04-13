/**
 * CLAUDE_CONFIG_DIR per agent.
 *
 * Each agent gets its own Claude config directory at:
 *   context/agents/{agentId}/.claude-config/
 *
 * Contents:
 *   .credentials.json  — copied from ~/.claude/ (auth)
 *   settings.json       — per-agent settings (initially empty)
 *   skills/{slug}/SKILL.md — agent skills (copied from context/agents/{id}/skills/)
 */

import { existsSync, mkdirSync, copyFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { agentClaudeConfigDir, agentResourceDir } from "../context/paths.js";

const USER_CLAUDE_DIR = join(homedir(), ".claude");
const CREDENTIALS_FILE = ".credentials.json";

/**
 * Ensures the CLAUDE_CONFIG_DIR for an agent exists and is populated.
 * Safe to call multiple times — only creates/copies if not present.
 *
 * Returns the absolute path to the config dir.
 */
export function ensureClaudeConfigDir(agentId: string): string {
  const configDir = agentClaudeConfigDir(agentId);

  // Create directory structure
  mkdirSync(configDir, { recursive: true });

  // Copy credentials if not present
  const credsDest = join(configDir, CREDENTIALS_FILE);
  if (!existsSync(credsDest)) {
    const credsSrc = join(USER_CLAUDE_DIR, CREDENTIALS_FILE);
    if (existsSync(credsSrc)) {
      copyFileSync(credsSrc, credsDest);
      console.log(`[claude-config] copied credentials for ${agentId}`);
    } else {
      console.warn(`[claude-config] no credentials found at ${credsSrc}`);
    }
  }

  // Create empty settings.json if not present
  const settingsPath = join(configDir, "settings.json");
  if (!existsSync(settingsPath)) {
    writeFileSync(settingsPath, "{}\n");
  }

  // Sync skills from agent's skills directory
  syncSkills(agentId, configDir);

  return configDir;
}

/**
 * Copies agent skills from context/agents/{id}/skills/ to .claude-config/skills/.
 * The CLI loads skills from {CLAUDE_CONFIG_DIR}/skills/{slug}/SKILL.md automatically.
 */
function syncSkills(agentId: string, configDir: string): void {
  const srcSkillsDir = agentResourceDir(agentId, "skills");
  if (!existsSync(srcSkillsDir)) return;

  const destSkillsDir = join(configDir, "skills");
  mkdirSync(destSkillsDir, { recursive: true });

  const slugs = readdirSync(srcSkillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const slug of slugs) {
    const srcSkillFile = join(srcSkillsDir, slug, "SKILL.md");
    if (!existsSync(srcSkillFile)) continue;

    const destSlugDir = join(destSkillsDir, slug);
    mkdirSync(destSlugDir, { recursive: true });

    const destSkillFile = join(destSlugDir, "SKILL.md");
    copyFileSync(srcSkillFile, destSkillFile);
  }
}
