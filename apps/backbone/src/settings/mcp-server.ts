import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { systemDir } from "../context/paths.js";

export interface McpServerConfig {
  enabled: boolean;
  allowed_agents: string[];
  require_auth: boolean;
}

const DEFAULT_CONFIG: McpServerConfig = {
  enabled: false,
  allowed_agents: [],
  require_auth: true,
};

function configPath(): string {
  return join(systemDir(), "mcp-server.json");
}

export function loadMcpServerConfig(): McpServerConfig {
  const path = configPath();
  if (!existsSync(path)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw) as Partial<McpServerConfig>;
    return {
      enabled: parsed.enabled ?? DEFAULT_CONFIG.enabled,
      allowed_agents: parsed.allowed_agents ?? DEFAULT_CONFIG.allowed_agents,
      require_auth: parsed.require_auth ?? DEFAULT_CONFIG.require_auth,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveMcpServerConfig(config: McpServerConfig): void {
  const path = configPath();
  const dir = systemDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(config, null, 2), "utf-8");
}
