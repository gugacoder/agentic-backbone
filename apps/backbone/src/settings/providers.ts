import { existsSync } from "node:fs";
import { settingsPath } from "../context/paths.js";
import { readYaml, writeYaml } from "../context/readers.js";

export interface ProvidersConfig {
  openrouter?: { api_key?: string };
  openai?: { api_key?: string };
  brave?: { api_key?: string };
}

export function loadProvidersConfig(): ProvidersConfig {
  if (!existsSync(settingsPath())) {
    return {};
  }

  const settings = readYaml(settingsPath()) as Record<string, unknown>;
  const providers = settings["providers"] as Record<string, unknown> | undefined;
  if (!providers) return {};

  const result: ProvidersConfig = {};
  if (providers.openrouter) {
    const or = providers.openrouter as Record<string, unknown>;
    result.openrouter = { api_key: or.api_key as string | undefined };
  }
  if (providers.openai) {
    const oa = providers.openai as Record<string, unknown>;
    result.openai = { api_key: oa.api_key as string | undefined };
  }
  if (providers.brave) {
    const b = providers.brave as Record<string, unknown>;
    result.brave = { api_key: b.api_key as string | undefined };
  }
  return result;
}

export function saveProvidersConfig(config: ProvidersConfig): void {
  const settings = existsSync(settingsPath())
    ? (readYaml(settingsPath()) as Record<string, unknown>)
    : {};
  settings["providers"] = config;
  writeYaml(settingsPath(), settings);
}
