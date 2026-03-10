import { findAdapter } from "../context/resolver.js";
import { getBuiltinDef, type ConnectorType } from "./builtin.js";
import {
  createMysqlConnector,
  createPostgresConnector,
  createEvolutionConnector,
  createWhisperConnector,
  type MysqlParams,
  type PostgresParams,
  type EvolutionParams,
  type WhisperParams,
} from "./connectors/index.js";

export interface AdapterInstance {
  [method: string]: (...args: unknown[]) => Promise<unknown>;
}

const CONNECTOR_FACTORIES: Record<ConnectorType, (params: Record<string, unknown>) => AdapterInstance> = {
  mysql: (p) => createMysqlConnector(p as unknown as MysqlParams) as unknown as AdapterInstance,
  postgres: (p) => createPostgresConnector(p as unknown as PostgresParams) as unknown as AdapterInstance,
  evolution: (p) => createEvolutionConnector(p as unknown as EvolutionParams) as unknown as AdapterInstance,
  whisper: (p) => createWhisperConnector(p as unknown as WhisperParams) as unknown as AdapterInstance,
};

const cache = new Map<string, AdapterInstance>();

/**
 * Load an adapter by slug, resolving its connector automatically.
 *
 * Resolution order:
 *   1. Check cache
 *   2. Try YAML adapter (via findAdapter)
 *   3. Try built-in adapter (via getBuiltinDef)
 *   4. Throw if neither found
 */
export async function loadAdapter(slug: string): Promise<AdapterInstance> {
  const cached = cache.get(slug);
  if (cached) return cached;

  // Try YAML adapter first (skip builtins — they are handled below with env-based params)
  const yamlAdapter = findAdapter(slug);
  if (yamlAdapter && yamlAdapter.source !== "builtin") {
    const connector = yamlAdapter.metadata.connector as ConnectorType | undefined;
    if (!connector) {
      throw new Error(`Adapter "${slug}" does not declare a connector`);
    }

    const factory = CONNECTOR_FACTORIES[connector];
    if (!factory) {
      throw new Error(`Unknown connector type "${connector}" for adapter "${slug}"`);
    }

    const rawParams = (yamlAdapter.metadata.params ?? {}) as Record<string, unknown>;
    // Coerce port to number for YAML adapters
    if (rawParams.port !== undefined) {
      rawParams.port = Number(rawParams.port);
    }

    const instance = factory(rawParams);
    cache.set(slug, instance);
    return instance;
  }

  // Try built-in adapter
  const builtinDef = getBuiltinDef(slug);
  if (builtinDef) {
    const factory = CONNECTOR_FACTORIES[builtinDef.connector];
    const params = builtinDef.params();
    const instance = factory(params);
    cache.set(slug, instance);
    return instance;
  }

  throw new Error(`Adapter "${slug}" not found`);
}

/**
 * Close and remove a cached adapter instance.
 */
export async function unloadAdapter(slug: string): Promise<void> {
  const instance = cache.get(slug);
  if (instance && typeof instance.close === "function") {
    await instance.close();
  }
  cache.delete(slug);
}

/**
 * Close all cached adapter instances.
 */
export async function unloadAllAdapters(): Promise<void> {
  for (const [key, instance] of cache) {
    if (typeof instance.close === "function") {
      try {
        await instance.close();
      } catch {
        // ignore close errors during shutdown
      }
    }
    cache.delete(key);
  }
}
