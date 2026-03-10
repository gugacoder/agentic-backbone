import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { eventBus } from "../events/index.js";
import type { BackboneModule, ModuleContext, ModuleHealth } from "./types.js";
import { CONTEXT_DIR } from "../context/paths.js";

const DATA_DIR = join(process.cwd(), "data", "modules");
const MODULES_CONTEXT_DIR = join(CONTEXT_DIR, "modules");

const moduleStates = new Map<
  string,
  { module: BackboneModule; healthy: boolean }
>();

/**
 * Starts all registered modules in order.
 * If a module's start() throws, it is marked unhealthy and the rest continue.
 * Mounts module routes at /modules/{name}/ on the provided app.
 */
export async function startModules(
  modules: BackboneModule[],
  app: Hono
): Promise<void> {
  for (const mod of modules) {
    const contextDir = join(MODULES_CONTEXT_DIR, mod.name);
    const dbPath = join(DATA_DIR, `${mod.name}.sqlite`);

    // Ensure directories exist
    mkdirSync(contextDir, { recursive: true });
    mkdirSync(DATA_DIR, { recursive: true });

    const ctx: ModuleContext = {
      eventBus,
      dbPath,
      contextDir,
      log: (msg: string) => console.log(`[module:${mod.name}] ${msg}`),
      env: process.env as Record<string, string | undefined>,
    };

    try {
      await mod.start(ctx);
      moduleStates.set(mod.name, { module: mod, healthy: true });

      if (mod.routes) {
        app.route(`/modules/${mod.name}`, mod.routes);
      }

      console.log(`[backbone] module started: ${mod.name}`);
    } catch (err) {
      moduleStates.set(mod.name, { module: mod, healthy: false });
      console.error(
        `[backbone] module failed to start: ${mod.name}`,
        err instanceof Error ? err.message : err
      );
    }
  }
}

/**
 * Stops all registered modules in reverse order.
 * If a module's stop() throws, the error is logged and the rest continue.
 */
export async function stopModules(): Promise<void> {
  const entries = [...moduleStates.entries()].reverse();

  for (const [name, { module }] of entries) {
    try {
      await module.stop();
      console.log(`[backbone] module stopped: ${name}`);
    } catch (err) {
      console.error(
        `[backbone] module failed to stop: ${name}`,
        err instanceof Error ? err.message : err
      );
    }
  }

  moduleStates.clear();
}

/**
 * Returns the health of all registered modules.
 */
export function getModuleHealth(): Record<string, ModuleHealth> {
  const result: Record<string, ModuleHealth> = {};

  for (const [name, { module, healthy }] of moduleStates) {
    if (!healthy) {
      result[name] = { status: "unhealthy", details: { reason: "start failed" } };
      continue;
    }
    try {
      result[name] = module.health();
    } catch {
      result[name] = { status: "unhealthy", details: { reason: "health() threw" } };
    }
  }

  return result;
}
