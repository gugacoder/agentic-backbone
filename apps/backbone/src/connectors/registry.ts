import { existsSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import type { Hono } from "hono";
import yaml from "js-yaml";
import { readContextFile } from "../context/frontmatter.js";
import {
  type ResourceKind,
  sharedResourceDir,
  systemResourceDir,
  agentResourceDir,
  agentsDir,
} from "../context/paths.js";
import { getResourceDirs } from "../context/resolver.js";
import { formatError } from "../utils/errors.js";
import { maskSensitiveFields, warnPlainTextSecrets } from "../utils/sensitive.js";
import type {
  ConnectorDef,
  ConnectorContext,
  ConnectorHealth,
  ResolvedAdapter,
  AdapterInstance,
} from "./types.js";

const KIND: ResourceKind = "adapters";
const FILENAME = "ADAPTER.yaml";

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
      const yamlPath = join(dir, slug, FILENAME);
      if (!existsSync(yamlPath)) continue;

      const raw = readContextFile(yamlPath);
      const parsed = yaml.load(raw);
      const metadata = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;

      const connector = (metadata.connector as string) ?? "";
      const params = (metadata.params as Record<string, unknown>) ?? {};
      const credential = (metadata.credential as Record<string, unknown>) ?? params;
      const options = (metadata.options as Record<string, unknown>) ?? {};

      entries.push({
        slug,
        connector,
        credential,
        options,
        policy: (metadata.policy as string) ?? "readonly",
        name: (metadata.name as string) ?? slug,
        description: (metadata.description as string) ?? "",
        source,
        dir: dirname(yamlPath),
        content: raw,
        metadata,
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
    updates: { name?: string; description?: string; policy?: string; params?: Record<string, unknown> }
  ): ResolvedAdapter {
    const adapterDir = join(this.resolveDir(scope), slug);
    const yamlPath = join(adapterDir, FILENAME);

    if (!existsSync(yamlPath)) {
      throw new Error(`Adapter ${slug} not found in scope ${scope}`);
    }

    const raw = readFileSync(yamlPath, "utf-8");
    const config = (yaml.load(raw) as Record<string, unknown>) ?? {};

    if (updates.name !== undefined) config.name = updates.name;
    if (updates.description !== undefined) config.description = updates.description;
    if (updates.policy !== undefined) config.policy = updates.policy;
    if (updates.params !== undefined) config.params = updates.params;

    // Warn about plain text credentials
    const credential = (config.credential ?? config.params) as Record<string, unknown> | undefined;
    if (credential) warnPlainTextSecrets(credential, `adapters:${slug}`);

    writeFileSync(yamlPath, yaml.dump(config, { lineWidth: -1, quotingType: '"' }));

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

  // --- Direct adapter lookup (no agent context) ---

  findAdapter(slug: string): ResolvedAdapter | null {
    for (const dir of [sharedResourceDir(KIND), systemResourceDir(KIND)]) {
      const entries = this.scanAdaptersInDir(dir, "shared");
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
