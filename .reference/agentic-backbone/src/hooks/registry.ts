import { loadGlobalHooks } from "./loader.js";
import type { HookEntry, HookEventName, AnyHookContext } from "./types.js";

// --- Module state ---

let hooks: HookEntry[] = [];
let hooksByEvent = new Map<HookEventName, HookEntry[]>();

function indexByEvent(entries: HookEntry[]): Map<HookEventName, HookEntry[]> {
  const map = new Map<HookEventName, HookEntry[]>();
  for (const entry of entries) {
    if (!entry.enabled || !entry.handler) continue;
    for (const event of entry.events) {
      let list = map.get(event);
      if (!list) {
        list = [];
        map.set(event, list);
      }
      list.push(entry);
    }
  }
  // Sort each list by priority descending (higher runs first)
  for (const list of map.values()) {
    list.sort((a, b) => b.priority - a.priority);
  }
  return map;
}

// --- Public API ---

export async function initHooks(): Promise<void> {
  hooks = await loadGlobalHooks();
  hooksByEvent = indexByEvent(hooks);

  const active = hooks.filter((h) => h.enabled && h.handler).length;
  console.log(`[hooks] initialized: ${active} loaded`);
}

export async function reloadHooks(): Promise<void> {
  hooks = await loadGlobalHooks();
  hooksByEvent = indexByEvent(hooks);

  const active = hooks.filter((h) => h.enabled && h.handler).length;
  console.log(`[hooks] reloaded: ${active} loaded`);
}

export async function triggerHook(ctx: AnyHookContext): Promise<void> {
  const handlers = hooksByEvent.get(ctx.hookEvent);
  if (!handlers || handlers.length === 0) return;

  for (const entry of handlers) {
    try {
      await entry.handler!(ctx);
    } catch (err) {
      console.error(
        `[hooks] error in hook "${entry.slug}" for event "${ctx.hookEvent}":`,
        err
      );
    }
  }
}

export function getHookSnapshot(): {
  total: number;
  active: number;
  hooks: Array<{
    slug: string;
    name: string;
    description: string;
    events: HookEventName[];
    priority: number;
    enabled: boolean;
    source: string;
    loaded: boolean;
    error?: string;
  }>;
} {
  return {
    total: hooks.length,
    active: hooks.filter((h) => h.enabled && h.handler).length,
    hooks: hooks.map((h) => ({
      slug: h.slug,
      name: h.name,
      description: h.description,
      events: h.events,
      priority: h.priority,
      enabled: h.enabled,
      source: h.source,
      loaded: h.handler !== null,
      error: h.error,
    })),
  };
}

export function getHookCount(): number {
  return hooks.filter((h) => h.enabled && h.handler).length;
}
