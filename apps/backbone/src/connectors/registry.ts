import { existsSync, readdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import type { Hono } from "hono";
import { readYaml, writeYaml } from "../context/readers.js";
import { AdapterYmlSchema } from "../context/schemas.js";
import {
  type ResourceKind,
  sharedResourceDir,
  systemResourceDir,
  agentResourceDir,
  agentsDir,
} from "../context/paths.js";
import { getResourceDirs } from "../context/resolver.js";
import { formatError } from "../utils/errors.js";
import { maskSensitiveFields } from "../utils/sensitive.js";
import type {
  ConnectorDef,
  ConnectorContext,
  ConnectorHealth,
  ResolvedAdapter,
  AdapterInstance,
} from "./types.js";

const KIND: ResourceKind = "adapters";
const FILENAME = "ADAPTER.yml";

function maskCredentials(adapter: ResolvedAdapter): ResolvedAdapter {
  return { ...adapter, credential: maskSensitiveFields(adapter.credential) };
}

export class ConnectorRegistry {
  private connectors = new Map<string, ConnectorDef>();
  private clientCache = new Map<string, AdapterInstance>();
  private started = false;

  // --- Connector registration ---

  register(def: ConnectorDef): void {
    this.connectors.set(def.slug, def);
  }

  get(slug: string): ConnectorDef | undefined {
    return this.connectors.get(slug);
  }

  list(): ConnectorDef[] {
    return [...this.connectors.values()];
  }

  // --- Adapter YAML scanning ---

  private scanAdaptersInDir(dir: string, source: string): ResolvedAdapter[] {
    if (!existsSync(dir)) return [];

    const entries: ResolvedAdapter[] = [];
    for (const slug of readdirSync(dir)) {
      const ymlPath = join(dir, slug, FILENAME);
      if (!existsSync(ymlPath)) continue;

      const raw = readYaml(ymlPath);
      const result = AdapterYmlSchema.safeParse(raw);
      if (!result.success) {
        console.warn(`[connectors] invalid ADAPTER.yml for ${slug}:`, result.error.issues);
        continue;
      }
      const data = result.data;

      const params = data.params ?? {};
      const credential = data.credential ?? params;
      const options = data.options ?? {};

      entries.push({
        slug,
        connector: data.connector,
        credential,
        options,
        policy: data.policy,
        name: data.name ?? slug,
        description: data.description ?? "",
        source,
        dir: dirname(ymlPath),
        content: "",
        metadata: data as Record<string, unknown>,
      });
    }
    return entries;
  }

  resolveAdapters(agentId: string): Map<string, ResolvedAdapter> {
    const result = new Map<string, ResolvedAdapter>();
    for (const { dir, source } of getResourceDirs(agentId, KIND)) {
      for (const entry of this.scanAdaptersInDir(dir, source)) {
        result.set(entry.slug, entry); // last wins (higher precedence)
      }
    }
    return result;
  }

  // --- Client factory ---

  createClient(adapterSlug: string): AdapterInstance {
    const cached = this.clientCache.get(adapterSlug);
    if (cached) return cached;

    const adapter = this.findAdapter(adapterSlug);
    if (!adapter) {
      throw new Error(`Adapter "${adapterSlug}" not found`);
    }

    const connectorDef = this.connectors.get(adapter.connector);
    if (!connectorDef) {
      throw new Error(`Connector "${adapter.connector}" not found for adapter "${adapterSlug}"`);
    }

    const credential = connectorDef.credentialSchema.parse(adapter.credential);
    const options = connectorDef.optionsSchema.parse(adapter.options);
    const instance = connectorDef.createClient(credential, options) as AdapterInstance;

    this.clientCache.set(adapterSlug, instance);
    return instance;
  }

  // --- Cache invalidation ---

  invalidateClient(slug: string): void {
    const instance = this.clientCache.get(slug);
    if (instance && typeof instance.close === "function") {
      instance.close().catch(() => {});
    }
    this.clientCache.delete(slug);
  }

  invalidateAllClients(): void {
    for (const slug of [...this.clientCache.keys()]) {
      this.invalidateClient(slug);
    }
    console.log("[connectors] all client caches invalidated");
  }

  // --- Tool composition ---

  composeTools(agentId: string): Record<string, any> | null {
    const adapters = this.resolveAdapters(agentId);
    if (adapters.size === 0) return null;

    const groups = new Map<string, { slug: string; policy: string }[]>();
    for (const [slug, a] of adapters) {
      if (!a.connector) continue;
      let group = groups.get(a.connector);
      if (!group) {
        group = [];
        groups.set(a.connector, group);
      }
      group.push({ slug, policy: a.policy });
    }

    const tools: Record<string, any> = {};

    for (const [connectorSlug, adapterList] of groups) {
      const connectorDef = this.connectors.get(connectorSlug);
      if (!connectorDef?.createTools) continue;

      const connectorTools = connectorDef.createTools(adapterList);
      if (connectorTools) {
        Object.assign(tools, connectorTools);
      }
    }

    return Object.keys(tools).length > 0 ? tools : null;
  }

  // --- Prompt generation ---

  formatPrompt(agentId: string): string {
    const adapters = this.resolveAdapters(agentId);
    if (adapters.size === 0) return "";

    let prompt = "<available_adapters>\n";
    for (const [slug, a] of adapters) {
      prompt += `- **${a.name}** (${a.connector}, ${a.policy}): ${a.description}\n`;
      prompt += `  slug: ${slug}\n`;
    }
    prompt += "</available_adapters>\n";
    prompt += "Use as tools de adapter (ex: mysql_query, postgres_query, evolution_api) para interagir com os adapters.\n\n";
    return prompt;
  }

  // --- Lifecycle ---

  async startAll(app: Hono, ctx: ConnectorContext): Promise<void> {
    for (const def of this.connectors.values()) {
      try {
        if (def.start) {
          await def.start(ctx);
        }

        if (def.routes) {
          app.route(`/connectors/${def.slug}`, def.routes);
        }

        ctx.log(`connector started: ${def.slug}`);
      } catch (err) {
        ctx.log(
          `connector failed to start: ${def.slug} — ${formatError(err)}`
        );
      }
    }
    this.started = true;
  }

  async stopAll(): Promise<void> {
    // Close cached clients
    for (const [key, instance] of this.clientCache) {
      if (typeof instance.close === "function") {
        try {
          await instance.close();
        } catch {
          // ignore close errors during shutdown
        }
      }
      this.clientCache.delete(key);
    }

    // Stop connectors in reverse order
    const defs = [...this.connectors.values()].reverse();
    for (const def of defs) {
      try {
        if (def.stop) {
          await def.stop();
        }
      } catch (err) {
        console.error(
          `[connectors] failed to stop: ${def.slug}`,
          err instanceof Error ? err.message : err
        );
      }
    }

    this.started = false;
  }

  healthAll(): Record<string, ConnectorHealth> {
    const result: Record<string, ConnectorHealth> = {};
    for (const def of this.connectors.values()) {
      if (def.health) {
        try {
          result[def.slug] = def.health();
        } catch {
          result[def.slug] = { status: "unhealthy", details: { reason: "health() threw" } };
        }
      }
    }
    return result;
  }

  // --- Admin API (for routes) ---

  listAdapters(): ResolvedAdapter[] {
    const adapters: ResolvedAdapter[] = [];

    const sharedDir = sharedResourceDir(KIND);
    if (existsSync(sharedDir)) {
      adapters.push(...this.scanAdaptersInDir(sharedDir, "shared"));
    }

    const sysDir = systemResourceDir(KIND);
    if (existsSync(sysDir)) {
      adapters.push(...this.scanAdaptersInDir(sysDir, "system"));
    }

    const agentsRoot = agentsDir();
    if (existsSync(agentsRoot)) {
      for (const agentId of readdirSync(agentsRoot)) {
        const agentAdaptersDir = agentResourceDir(agentId, KIND);
        if (!existsSync(agentAdaptersDir)) continue;
        adapters.push(...this.scanAdaptersInDir(agentAdaptersDir, `agent:${agentId}`));
      }
    }

    return adapters.map(maskCredentials);
  }

  getAdapter(scope: string, slug: string): ResolvedAdapter | null {
    const dir = this.resolveDir(scope);
    const entries = this.scanAdaptersInDir(dir, scope);
    const found = entries.find((a) => a.slug === slug) ?? null;
    return found ? maskCredentials(found) : null;
  }

  updateAdapter(
    scope: string,
    slug: string,
    updates: { name?: string; description?: string; policy?: string; params?: Record<string, unknown>; enabled?: boolean }
  ): ResolvedAdapter {
    const adapterDir = join(this.resolveDir(scope), slug);
    const ymlPath = join(adapterDir, FILENAME);

    if (!existsSync(ymlPath)) {
      throw new Error(`Adapter ${slug} not found in scope ${scope}`);
    }

    const config = readYaml(ymlPath);

    if (updates.name !== undefined) config.name = updates.name;
    if (updates.description !== undefined) config.description = updates.description;
    if (updates.policy !== undefined) config.policy = updates.policy;
    if (updates.params !== undefined) config.params = updates.params;
    if (updates.enabled !== undefined) config.enabled = updates.enabled;

    writeYaml(ymlPath, config);

    this.invalidateClient(slug);

    const updated = this.getAdapter(scope, slug);
    if (!updated) throw new Error(`Failed to read adapter after update`);
    return updated;
  }

  deleteAdapter(scope: string, slug: string): boolean {
    const adapterDir = join(this.resolveDir(scope), slug);
    if (!existsSync(adapterDir)) return false;
    rmSync(adapterDir, { recursive: true, force: true });
    return true;
  }

  // --- Test adapter connection ---

  async testAdapter(slug: string): Promise<{ ok: boolean; latencyMs?: number; message?: string; error?: string }> {
    const adapter = this.findAdapter(slug);
    if (!adapter) {
      return { ok: false, error: `Adapter "${slug}" not found` };
    }

    const connectorDef = this.connectors.get(adapter.connector);
    if (!connectorDef) {
      return { ok: false, error: `Connector "${adapter.connector}" not registered` };
    }

    const start = Date.now();
    try {
      let credential: unknown;
      let options: unknown;
      try {
        credential = connectorDef.credentialSchema.parse(adapter.credential);
        options = connectorDef.optionsSchema.parse(adapter.options);
      } catch (err) {
        return { ok: false, error: `Invalid credential/options: ${formatError(err)}` };
      }

      const client = connectorDef.createClient(credential, options) as Record<string, unknown>;

      if (typeof client["query"] === "function") {
        await (client["query"] as (sql: string) => Promise<unknown>)("SELECT 1");
      }

      if (typeof (client as any).close === "function") {
        await (client as any).close().catch(() => {});
      }

      return { ok: true, latencyMs: Date.now() - start, message: "Conexao bem-sucedida" };
    } catch (err) {
      return { ok: false, error: formatError(err) };
    }
  }

  // --- Direct adapter lookup (no agent context) ---

  findAdapterMasked(slug: string): ResolvedAdapter | null {
    const adapter = this.findAdapter(slug);
    return adapter ? maskCredentials(adapter) : null;
  }

  findAdapter(slug: string): ResolvedAdapter | null {
    for (const [dir, source] of [
      [sharedResourceDir(KIND), "shared"] as const,
      [systemResourceDir(KIND), "system"] as const,
    ]) {
      const entries = this.scanAdaptersInDir(dir, source);
      const found = entries.find((a) => a.slug === slug);
      if (found) return found;
    }
    return null;
  }

  private resolveDir(scope: string): string {
    if (scope === "shared") return sharedResourceDir(KIND);
    if (scope === "system") return systemResourceDir(KIND);
    return agentResourceDir(scope, KIND);
  }
}
