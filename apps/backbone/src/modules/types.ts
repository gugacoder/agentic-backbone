import type { Hono } from "hono";
import type { BackboneEventBus } from "../events/index.js";
import type { ChannelAdapterFactory } from "../channel-adapters/types.js";

// --- Module Health ---

export interface ModuleHealth {
  status: "healthy" | "degraded" | "unhealthy";
  details?: Record<string, unknown>;
}

// --- Module Context ---

export interface ModuleContext {
  eventBus: BackboneEventBus;
  dbPath: string;
  contextDir: string;
  log: (msg: string) => void;
  env: Record<string, string | undefined>;
  registerChannelAdapter(slug: string, factory: ChannelAdapterFactory): void;
}

// --- Module Contract ---

export interface BackboneModule {
  name: string;
  start(ctx: ModuleContext): Promise<void>;
  stop(): Promise<void>;
  health(): ModuleHealth;
  routes?: Hono;
}
