import { existsSync } from "node:fs";
import { join } from "node:path";
import { systemDir } from "../context/paths.js";
import { readYaml, writeYaml } from "../context/readers.js";

// --- Types ---

export type WebSearchProviderType = "duckduckgo" | "brave" | "none";

export interface WebSearchConfig {
  provider: WebSearchProviderType;
}

const VALID_PROVIDERS: WebSearchProviderType[] = ["duckduckgo", "brave", "none"];

// --- Path ---

function settingsPath(): string {
  return join(systemDir(), "settings.yml");
}

// --- Read / Write ---

export function loadWebSearchConfig(): WebSearchConfig {
  if (!existsSync(settingsPath())) {
    return { provider: "duckduckgo" };
  }

  const settings = readYaml(settingsPath()) as Record<string, unknown>;
  const ws = settings["web-search"] as Record<string, unknown> | undefined;
  if (ws && VALID_PROVIDERS.includes(ws.provider as WebSearchProviderType)) {
    return { provider: ws.provider as WebSearchProviderType };
  }
  return { provider: "duckduckgo" };
}

export function saveWebSearchConfig(config: WebSearchConfig): void {
  const settings = existsSync(settingsPath())
    ? (readYaml(settingsPath()) as Record<string, unknown>)
    : {};
  settings["web-search"] = { provider: config.provider };
  writeYaml(settingsPath(), settings);
}

export function isValidWebSearchProvider(value: string): value is WebSearchProviderType {
  return VALID_PROVIDERS.includes(value as WebSearchProviderType);
}
