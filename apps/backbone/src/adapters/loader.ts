import { join } from "node:path";
import { existsSync } from "node:fs";
import { findAdapter, resolveConnectorDir } from "../context/resolver.js";

export interface AdapterInstance {
  [method: string]: (...args: unknown[]) => Promise<unknown>;
}

const cache = new Map<string, AdapterInstance>();

/**
 * Load an adapter by slug, resolving its connector automatically.
 *
 * Usage:
 *   const db = await loadAdapter("my-adapter");
 *   const rows = await db.query("SELECT * FROM users");
 *   await db.close();
 */
export async function loadAdapter(slug: string): Promise<AdapterInstance> {
  const cached = cache.get(slug);
  if (cached) return cached;

  const adapter = findAdapter(slug);
  if (!adapter) {
    throw new Error(`Adapter "${slug}" not found`);
  }

  const connector = adapter.metadata.connector as string | undefined;
  if (!connector) {
    throw new Error(`Adapter "${slug}" does not declare a connector`);
  }

  const connectorDir = resolveConnectorDir(connector);
  if (!connectorDir) {
    throw new Error(`Connector "${connector}" not found`);
  }

  const factoryPath = join(connectorDir, "adapter.mjs");
  if (!existsSync(factoryPath)) {
    throw new Error(
      `Connector "${connector}" has no adapter.mjs at ${factoryPath}`
    );
  }

  const mod = await import(factoryPath);
  const createAdapter =
    mod.createAdapter ?? mod.default?.createAdapter ?? mod.default;

  if (typeof createAdapter !== "function") {
    throw new Error(
      `Connector "${connector}" adapter.mjs does not export createAdapter()`
    );
  }

  const adapterDir = join(adapter.path, "..");
  const instance = createAdapter(adapterDir) as AdapterInstance;

  cache.set(slug, instance);
  return instance;
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
