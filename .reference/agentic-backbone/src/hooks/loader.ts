import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseFrontmatter } from "../context/frontmatter.js";
import { sharedDir, systemDir, agentDir } from "../context/paths.js";
import type { HookEntry, HookEventName, HookHandler } from "./types.js";

const HOOK_FILENAME = "HOOK.md";
const HANDLER_FILENAME = "handler.mjs";

const VALID_EVENTS = new Set<HookEventName>([
  "startup",
  "heartbeat:before",
  "heartbeat:after",
  "agent:before",
  "agent:after",
  "message:received",
  "message:sent",
  "registry:changed",
]);

function parseEvents(raw: unknown): HookEventName[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((s) => s.trim() as HookEventName)
    .filter((e) => VALID_EVENTS.has(e));
}

async function loadHandler(handlerPath: string): Promise<HookHandler | null> {
  if (!existsSync(handlerPath)) return null;
  const url = pathToFileURL(handlerPath).href + `?t=${Date.now()}`;
  const mod = await import(url);
  return typeof mod.default === "function" ? mod.default : null;
}

function scanHooksDir(dir: string, source: string): HookEntry[] {
  if (!existsSync(dir)) return [];

  const entries: HookEntry[] = [];
  for (const slug of readdirSync(dir)) {
    const hookDir = join(dir, slug);
    const mdPath = join(hookDir, HOOK_FILENAME);
    if (!existsSync(mdPath)) continue;

    const raw = readFileSync(mdPath, "utf-8");
    const { metadata, content } = parseFrontmatter(raw);

    const events = parseEvents(metadata.events);
    if (events.length === 0) continue;

    const name =
      typeof metadata.name === "string" ? metadata.name : slug;
    const description =
      typeof metadata.description === "string"
        ? metadata.description
        : content.slice(0, 200).trim();
    const enabled = metadata.enabled !== false;
    const priority =
      typeof metadata.priority === "number" ? metadata.priority : 0;

    const handlerPath = join(hookDir, HANDLER_FILENAME);

    entries.push({
      slug,
      name,
      description,
      events,
      priority,
      enabled,
      source,
      dir: hookDir,
      handlerPath,
      handler: null,
    });
  }
  return entries;
}

async function importHandlers(entries: HookEntry[]): Promise<void> {
  for (const entry of entries) {
    if (!entry.enabled) continue;
    try {
      entry.handler = await loadHandler(entry.handlerPath);
      if (!entry.handler) {
        entry.error = `no default export in ${HANDLER_FILENAME}`;
      }
    } catch (err) {
      entry.handler = null;
      entry.error =
        err instanceof Error ? err.message : String(err);
      console.warn(`[hooks] failed to load handler for ${entry.slug}:`, err);
    }
  }
}

export async function loadGlobalHooks(): Promise<HookEntry[]> {
  const entries = [
    ...scanHooksDir(join(sharedDir(), "hooks"), "shared"),
    ...scanHooksDir(join(systemDir(), "hooks"), "system"),
  ];
  await importHandlers(entries);
  return entries;
}

export async function loadAgentHooks(agentId: string): Promise<HookEntry[]> {
  const globalEntries = await loadGlobalHooks();
  const agentEntries = scanHooksDir(
    join(agentDir(agentId), "hooks"),
    `agent:${agentId}`
  );
  await importHandlers(agentEntries);
  return [...globalEntries, ...agentEntries];
}
