import { readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { resolveAdapters } from "../context/resolver.js";
import type { ToolDefinition } from "../agent/tool-defs.js";

type ToolModule = {
  connector: string;
  create: (adapters: { slug: string; policy: string }[]) => ToolDefinition;
};

const toolsDir = join(dirname(fileURLToPath(import.meta.url)), "defs");

const toolModules: ToolModule[] = await Promise.all(
  readdirSync(toolsDir)
    .filter((f) => (f.endsWith(".js") || (f.endsWith(".ts") && !f.endsWith(".d.ts"))) && !f.startsWith("_"))
    .map((f) => import(pathToFileURL(join(toolsDir, f)).href) as Promise<ToolModule>)
);

export function createAdapterTools(agentId: string): ToolDefinition[] {
  const adapters = resolveAdapters(agentId);
  if (adapters.size === 0) return [];

  const groups = new Map<string, { slug: string; policy: string }[]>();
  for (const [slug, a] of adapters) {
    const connector = (a.metadata.connector as string) ?? "";
    if (!connector) continue;
    let group = groups.get(connector);
    if (!group) {
      group = [];
      groups.set(connector, group);
    }
    group.push({ slug, policy: (a.metadata.policy as string) ?? "readonly" });
  }

  const tools: ToolDefinition[] = [];
  for (const { connector, create } of toolModules) {
    const connectorAdapters = groups.get(connector);
    if (connectorAdapters?.length) {
      tools.push(create(connectorAdapters));
    }
  }

  return tools;
}
