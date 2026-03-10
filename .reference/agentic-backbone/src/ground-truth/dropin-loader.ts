import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseFrontmatter } from "../context/frontmatter.js";
import { loadAdapter } from "../adapters/loader.js";
import type { ToolDefinition } from "../agent/tool-defs.js";
import type { DropInToolContext, DropInToolModule } from "./types.js";
import {
  sharedResourceDir,
  agentResourceDir,
  userResourceDir,
  parseAgentId,
} from "../context/paths.js";

/**
 * Varre os diretorios de tools do agente (shared + agent-specific).
 * Pastas prefixadas com "_" sao ignoradas (helpers, _lib).
 * Presenca de tool.ts = tool executavel. So TOOL.md = apenas prompt.
 * enabled: false no frontmatter = ignorada.
 *
 * Suporta subdiretorios de categoria (ex: ground-truth/, prompt-tools/).
 * Se uma entrada nao contem tool.ts+TOOL.md mas e um diretorio sem prefixo "_",
 * o loader desce um nivel e varre seus filhos.
 */
export async function loadDropInTools(agentId: string): Promise<ToolDefinition[]> {
  const { owner } = parseAgentId(agentId);

  const dirs = [
    sharedResourceDir("tools"),
    owner !== "system" ? userResourceDir(owner, "tools") : null,
    agentResourceDir(agentId, "tools"),
  ].filter(Boolean) as string[];

  const seen = new Map<string, ToolDefinition>(); // slug → def (agent sobrescreve shared)

  // AdapterInstance uses index-signature; AdapterHandle has explicit query/mutate.
  // Identical at runtime — double-cast needed because TS can't see structural overlap.
  const ctx: DropInToolContext = {
    adapter: loadAdapter as unknown as DropInToolContext["adapter"],
  };

  for (const dir of dirs) {
    if (!existsSync(dir)) continue;

    for (const entry of readdirSync(dir)) {
      if (entry.startsWith("_") || entry.startsWith(".")) continue;

      const entryPath = join(dir, entry);

      // Direct tool: entry/tool.ts + entry/TOOL.md
      if (await tryRegisterTool(entryPath, entry, ctx, seen)) continue;

      // Category subdir: entry is a directory without tool.ts — scan its children
      if (statSync(entryPath).isDirectory()) {
        for (const slug of readdirSync(entryPath)) {
          if (slug.startsWith("_") || slug.startsWith(".")) continue;
          await tryRegisterTool(join(entryPath, slug), slug, ctx, seen);
        }
      }
    }
  }

  return Array.from(seen.values());
}

async function tryRegisterTool(
  toolDir: string,
  slug: string,
  ctx: DropInToolContext,
  seen: Map<string, ToolDefinition>,
): Promise<boolean> {
  const toolTs = join(toolDir, "tool.ts");
  const toolMd = join(toolDir, "TOOL.md");

  if (!existsSync(toolTs) || !existsSync(toolMd)) return false;

  const raw = readFileSync(toolMd, "utf-8");
  const { metadata } = parseFrontmatter(raw);

  if (metadata.enabled === false) return true; // recognized but disabled

  const name = String(metadata.name ?? slug.replace(/-/g, "_"));
  const description = String(metadata.description ?? "");

  // Dynamic import — requires tsx loader for .ts files
  const mod = (await import(pathToFileURL(toolTs).href)) as { default: DropInToolModule };
  const { parameters, execute } = mod.default;

  seen.set(slug, {
    name,
    description,
    parameters,
    execute: (args: any) => execute(args, ctx),
  });

  return true;
}
