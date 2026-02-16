import {
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { execFile } from "node:child_process";
import yaml from "js-yaml";
import {
  sharedResourceDir,
  systemResourceDir,
  agentResourceDir,
  agentsDir,
  type ResourceKind,
} from "../context/paths.js";
import { resolveConnectorDir } from "../context/resolver.js";
import type { AdapterConfig, UpdateAdapterInput } from "./types.js";

const KIND: ResourceKind = "adapters";
const FILENAME = "ADAPTER.yaml";

// --- Helpers ---

function resolveDir(scope: string): string {
  if (scope === "shared") return sharedResourceDir(KIND);
  if (scope === "system") return systemResourceDir(KIND);
  return agentResourceDir(scope, KIND);
}

function parseYamlConfig(raw: string): Record<string, unknown> {
  const parsed = yaml.load(raw);
  return parsed && typeof parsed === "object"
    ? (parsed as Record<string, unknown>)
    : {};
}

function readAdapterConfig(
  dir: string,
  slug: string,
  source: string,
  includeContent: boolean
): AdapterConfig | null {
  const yamlPath = join(dir, slug, FILENAME);
  if (!existsSync(yamlPath)) return null;

  const raw = readFileSync(yamlPath, "utf-8");
  const metadata = parseYamlConfig(raw);
  const adapterDir = dirname(yamlPath);

  const connector = (metadata.connector as string) ?? "";
  const connectorDir = connector ? resolveConnectorDir(connector) : null;

  return {
    slug,
    name: (metadata.name as string) ?? slug,
    connector,
    policy: (metadata.policy as string) ?? "readonly",
    description: (metadata.description as string) ?? "",
    source,
    dir: adapterDir,
    connectorDir,
    content: includeContent ? raw : "",
    metadata,
  };
}

// --- Public API ---

export function listAdapters(): AdapterConfig[] {
  const adapters: AdapterConfig[] = [];

  // Scan shared adapters
  const sharedDir = sharedResourceDir(KIND);
  if (existsSync(sharedDir)) {
    for (const slug of readdirSync(sharedDir)) {
      const config = readAdapterConfig(sharedDir, slug, "shared", false);
      if (config) adapters.push(config);
    }
  }

  // Scan system adapters
  const sysDir = systemResourceDir(KIND);
  if (existsSync(sysDir)) {
    for (const slug of readdirSync(sysDir)) {
      const config = readAdapterConfig(sysDir, slug, "system", false);
      if (config) adapters.push(config);
    }
  }

  // Scan agent-scoped adapters
  const agentsRoot = agentsDir();
  if (existsSync(agentsRoot)) {
    for (const agentId of readdirSync(agentsRoot)) {
      const agentAdaptersDir = agentResourceDir(agentId, KIND);
      if (!existsSync(agentAdaptersDir)) continue;
      for (const slug of readdirSync(agentAdaptersDir)) {
        const config = readAdapterConfig(
          agentAdaptersDir,
          slug,
          `agent:${agentId}`,
          false
        );
        if (config) adapters.push(config);
      }
    }
  }

  return adapters;
}

export function getAdapter(scope: string, slug: string): AdapterConfig | null {
  const dir = resolveDir(scope);
  return readAdapterConfig(dir, slug, scope, true);
}

export function updateAdapterConfig(
  scope: string,
  slug: string,
  updates: UpdateAdapterInput
): AdapterConfig {
  const adapterDir = join(resolveDir(scope), slug);
  const yamlPath = join(adapterDir, FILENAME);

  if (!existsSync(yamlPath)) {
    throw new Error(`Adapter ${slug} not found in scope ${scope}`);
  }

  const raw = readFileSync(yamlPath, "utf-8");
  const config = parseYamlConfig(raw);

  if (updates.name !== undefined) config.name = updates.name;
  if (updates.description !== undefined) config.description = updates.description;
  if (updates.policy !== undefined) config.policy = updates.policy;
  if (updates.params !== undefined) config.params = updates.params;

  writeFileSync(yamlPath, yaml.dump(config, { lineWidth: -1, quotingType: '"' }));

  const connector = (config.connector as string) ?? "";
  const connectorDir = connector ? resolveConnectorDir(connector) : null;

  return {
    slug,
    name: (config.name as string) ?? slug,
    connector,
    policy: (config.policy as string) ?? "readonly",
    description: (config.description as string) ?? "",
    source: scope,
    dir: adapterDir,
    connectorDir,
    content: yaml.dump(config, { lineWidth: -1, quotingType: '"' }),
    metadata: config,
  };
}

export function deleteAdapterConfig(scope: string, slug: string): boolean {
  const adapterDir = join(resolveDir(scope), slug);
  if (!existsSync(adapterDir)) return false;

  rmSync(adapterDir, { recursive: true, force: true });
  return true;
}

export function testAdapterConnection(
  scope: string,
  slug: string
): Promise<{ status: "ok" | "error"; message: string }> {
  const adapter = getAdapter(scope, slug);
  if (!adapter) {
    return Promise.resolve({ status: "error", message: "Adapter not found" });
  }

  if (!adapter.connectorDir) {
    return Promise.resolve({
      status: "error",
      message: `Connector "${adapter.connector}" not found`,
    });
  }

  // Use connector's query.sh with adapter dir as argument
  const queryShPath = join(adapter.connectorDir, "query.sh");

  if (!existsSync(queryShPath)) {
    return Promise.resolve({
      status: "error",
      message: "Connector does not provide query.sh — connection test not available",
    });
  }

  return new Promise((resolve) => {
    execFile(
      "bash",
      [queryShPath, adapter.dir, "SELECT 1"],
      { cwd: adapter.connectorDir!, timeout: 15_000 },
      (err, stdout, stderr) => {
        if (err) {
          resolve({
            status: "error",
            message: stderr?.trim() || err.message,
          });
        } else {
          resolve({
            status: "ok",
            message: stdout?.trim() || "Connection successful",
          });
        }
      }
    );
  });
}
