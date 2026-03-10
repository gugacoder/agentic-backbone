import {
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { join, dirname } from "node:path";
import yaml from "js-yaml";
import {
  sharedResourceDir,
  systemResourceDir,
  agentResourceDir,
  agentsDir,
  type ResourceKind,
} from "../context/paths.js";
import { loadAdapter, unloadAdapter } from "./loader.js";
import { BUILTIN_ADAPTERS, isBuiltinAdapter } from "./builtin.js";
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

  return {
    slug,
    name: (metadata.name as string) ?? slug,
    connector,
    policy: (metadata.policy as string) ?? "readonly",
    description: (metadata.description as string) ?? "",
    source,
    dir: adapterDir,
    content: includeContent ? raw : "",
    metadata,
  };
}

// --- Public API ---

export function listAdapters(): AdapterConfig[] {
  const adapters: AdapterConfig[] = [];

  // Built-in adapters first
  for (const def of BUILTIN_ADAPTERS) {
    adapters.push({
      slug: def.slug,
      name: def.name,
      connector: def.connector,
      policy: def.policy,
      description: def.description,
      source: "builtin",
      dir: "",
        content: "",
      metadata: {
        name: def.name,
        connector: def.connector,
        policy: def.policy,
        description: def.description,
      },
    });
  }

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
  if (scope === "builtin") {
    const def = BUILTIN_ADAPTERS.find((d) => d.slug === slug);
    if (!def) return null;
    return {
      slug: def.slug,
      name: def.name,
      connector: def.connector,
      policy: def.policy,
      description: def.description,
      source: "builtin",
      dir: "",
        content: "",
      metadata: {
        name: def.name,
        connector: def.connector,
        policy: def.policy,
        description: def.description,
      },
    };
  }
  const dir = resolveDir(scope);
  return readAdapterConfig(dir, slug, scope, true);
}

export function updateAdapterConfig(
  scope: string,
  slug: string,
  updates: UpdateAdapterInput
): AdapterConfig {
  if (scope === "builtin" || isBuiltinAdapter(slug)) {
    throw new Error("Built-in adapters cannot be modified");
  }

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

  return {
    slug,
    name: (config.name as string) ?? slug,
    connector,
    policy: (config.policy as string) ?? "readonly",
    description: (config.description as string) ?? "",
    source: scope,
    dir: adapterDir,
    content: yaml.dump(config, { lineWidth: -1, quotingType: '"' }),
    metadata: config,
  };
}

export function deleteAdapterConfig(scope: string, slug: string): boolean {
  if (scope === "builtin" || isBuiltinAdapter(slug)) {
    throw new Error("Built-in adapters cannot be deleted");
  }

  const adapterDir = join(resolveDir(scope), slug);
  if (!existsSync(adapterDir)) return false;

  rmSync(adapterDir, { recursive: true, force: true });
  return true;
}

export async function testAdapterConnection(
  scope: string,
  slug: string
): Promise<{ status: "ok" | "error"; message: string }> {
  try {
    const instance = await loadAdapter(slug);

    if (typeof instance.health !== "function") {
      return {
        status: "error",
        message: `Adapter "${slug}" does not implement health()`,
      };
    }

    const msg = await instance.health();
    return { status: "ok", message: String(msg) || "Connection successful" };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  } finally {
    await unloadAdapter(slug);
  }
}
