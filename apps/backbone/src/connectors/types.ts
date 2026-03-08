import type { Hono } from "hono";
import type { z } from "zod";
import type { ChannelAdapter, ChannelAdapterFactory } from "../channels/delivery/types.js";
import type { BackboneEventBus } from "../events/index.js";

// --- Connector Health ---

export interface ConnectorHealth {
  status: "healthy" | "degraded" | "unhealthy";
  details?: Record<string, unknown>;
}

// --- Connector Context (passed to start/stop) ---

export interface ConnectorContext {
  eventBus: BackboneEventBus;
  log: (msg: string) => void;
  env: Record<string, string | undefined>;
  registerChannelAdapter(slug: string, factory: ChannelAdapterFactory): void;
}

// --- Connector Definition ---

export interface ConnectorDef {
  slug: string;
  credentialSchema: z.ZodObject<any>;
  optionsSchema: z.ZodObject<any>;
  createClient(credential: unknown, options: unknown): unknown;
  createTools?(adapters: { slug: string; policy: string }[], agentId?: string): Record<string, any> | null;
  routes?: Hono;
  start?(ctx: ConnectorContext): Promise<void>;
  stop?(): Promise<void>;
  health?(): ConnectorHealth;
}

// --- Resolved Adapter (from ADAPTER.yml) ---

export interface ResolvedAdapter {
  slug: string;
  connector: string;
  credential: Record<string, unknown>;
  options: Record<string, unknown>;
  policy: string;
  name: string;
  description: string;
  source: string;
  dir: string;
  content: string;
  metadata: Record<string, unknown>;
}

// --- Adapter Instance (client wrapper) ---

export interface AdapterInstance {
  [method: string]: (...args: unknown[]) => Promise<unknown>;
}
