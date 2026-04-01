import { existsSync } from "node:fs";
import { settingsPath } from "../context/paths.js";
import { readYaml, writeYaml } from "../context/readers.js";

export interface MenuContextConfig { [key: string]: boolean | undefined; }
export interface MenuConfig {
  contexts: {
    main: MenuContextConfig;
    agent: MenuContextConfig;
  };
}

export function loadMenuConfig(): MenuConfig {
  if (!existsSync(settingsPath())) {
    return { contexts: { main: {}, agent: {} } };
  }

  const settings = readYaml(settingsPath()) as Record<string, unknown>;
  const menu = settings["menu"] as Record<string, unknown> | undefined;
  if (!menu) return { contexts: { main: {}, agent: {} } };

  const contexts = menu["contexts"] as Record<string, unknown> | undefined;
  if (!contexts) return { contexts: { main: {}, agent: {} } };

  return {
    contexts: {
      main: (contexts["main"] as MenuContextConfig | undefined) ?? {},
      agent: (contexts["agent"] as MenuContextConfig | undefined) ?? {},
    },
  };
}

export function saveMenuConfig(config: MenuConfig): void {
  const settings = existsSync(settingsPath())
    ? (readYaml(settingsPath()) as Record<string, unknown>)
    : {};
  settings["menu"] = config;
  writeYaml(settingsPath(), settings);
}
