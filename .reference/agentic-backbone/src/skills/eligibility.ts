import { execSync } from "node:child_process";
import { platform } from "node:os";
import type { Skill, SkillConfig, EligibilityResult } from "./types.js";

// --- Binary detection ---

const binCache = new Map<string, boolean>();

function hasBinary(name: string): boolean {
  const cached = binCache.get(name);
  if (cached !== undefined) return cached;

  const cmd = platform() === "win32" ? `where ${name}` : `which ${name}`;
  try {
    execSync(cmd, { stdio: "ignore" });
    binCache.set(name, true);
    return true;
  } catch {
    binCache.set(name, false);
    return false;
  }
}

// --- Skill config from env ---

export function resolveSkillConfig(skillName: string): SkillConfig {
  const prefix = `SKILL_${skillName.toUpperCase().replace(/-/g, "_")}_`;
  const config: SkillConfig = {};

  for (const [key, val] of Object.entries(process.env)) {
    if (!key.startsWith(prefix) || !val) continue;
    const suffix = key.slice(prefix.length).toLowerCase();
    if (suffix === "enabled") config.enabled = val === "true";
    else if (suffix === "apikey") config.apiKey = val;
    else {
      if (!config.env) config.env = {};
      config.env[suffix] = val;
    }
  }

  return config;
}

// --- Eligibility check ---

export function checkEligibility(
  skill: Skill,
  config?: SkillConfig
): EligibilityResult {
  // Explicitly disabled
  if (config?.enabled === false) {
    return { eligible: false, reason: "disabled" };
  }

  const meta = skill.metadata;
  if (!meta) return { eligible: true };

  // OS mismatch
  if (meta.os && meta.os.length > 0) {
    if (!meta.os.includes(platform())) {
      return { eligible: false, reason: `os:${platform()} not in [${meta.os.join(",")}]` };
    }
  }

  // Always-include
  if (meta.always) return { eligible: true };

  // Missing binaries
  if (meta.requires?.bins) {
    for (const bin of meta.requires.bins) {
      if (!hasBinary(bin)) {
        return { eligible: false, reason: `missing binary: ${bin}` };
      }
    }
  }

  // Missing env vars
  if (meta.requires?.env) {
    for (const envVar of meta.requires.env) {
      if (!process.env[envVar]) {
        return { eligible: false, reason: `missing env: ${envVar}` };
      }
    }
  }

  return { eligible: true };
}

// --- Filter eligible skills ---

export function filterEligibleSkills(skills: Skill[]): Skill[] {
  return skills.filter((skill) => {
    const config = resolveSkillConfig(skill.name);
    return checkEligibility(skill, config).eligible;
  });
}

// --- Apply skill env overrides ---

export function applySkillEnvOverrides(
  skills: Skill[]
): () => void {
  const originals = new Map<string, string | undefined>();

  for (const skill of skills) {
    const config = resolveSkillConfig(skill.name);

    if (config.apiKey && skill.metadata?.primaryEnv) {
      originals.set(skill.metadata.primaryEnv, process.env[skill.metadata.primaryEnv]);
      process.env[skill.metadata.primaryEnv] = config.apiKey;
    }

    if (config.env) {
      for (const [k, v] of Object.entries(config.env)) {
        originals.set(k, process.env[k]);
        process.env[k] = v;
      }
    }
  }

  return () => {
    for (const [k, v] of originals) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
}
