import { readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import type { EvolutionConfig } from "./types.js";

/**
 * Reads and parses the CONFIG.yaml from the module's context directory.
 * Returns the fully resolved EvolutionConfig.
 */
export function loadEvolutionConfig(contextDir: string): EvolutionConfig {
  const filePath = join(contextDir, "CONFIG.yaml");
  const raw = readFileSync(filePath, "utf-8");
  const parsed = yaml.load(raw) as Record<string, unknown>;

  const probe = parsed.probe as Record<string, unknown> | undefined;
  const thresholds = parsed.thresholds as Record<string, unknown> | undefined;
  const flapping = thresholds?.flapping as Record<string, unknown> | undefined;
  const actions = parsed.actions as Record<string, unknown> | undefined;

  return {
    probe: {
      intervalMs: Number(probe?.intervalMs),
      timeoutMs: Number(probe?.timeoutMs),
    },
    thresholds: {
      flapping: {
        changes: Number(flapping?.changes),
        windowMs: Number(flapping?.windowMs),
      },
      prolongedOfflineMs: Number(thresholds?.prolongedOfflineMs),
    },
    actions: {
      maxRetries: Number(actions?.maxRetries),
      cooldownMs: Number(actions?.cooldownMs),
    },
  };
}
