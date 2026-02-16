import { EventEmitter } from "node:events";
import type { UsageData } from "../agent/index.js";
import type { JobStatus } from "../jobs/types.js";

// --- Event Map ---

export interface HeartbeatStatusEvent {
  ts: number;
  agentId: string;
  status: "ok-token" | "sent" | "skipped" | "failed";
  preview?: string;
  durationMs?: number;
  reason?: string;
  usage?: UsageData;
}

export interface ChannelMessageEvent {
  ts: number;
  channelId: string;
  agentId: string;
  role: "assistant" | "user" | "system";
  content: string;
  sessionId?: string;
}

export interface RegistryChangeEvent {
  ts: number;
  kind: "agents" | "channels" | "adapters";
  reason: "file-change";
  changedPath?: string;
}

export interface CronJobEvent {
  ts: number;
  jobSlug: string;
  agentId: string;
  action: "started" | "finished";
  status?: "ok" | "error" | "skipped";
  durationMs?: number;
  nextRunAtMs?: number;
  error?: string;
  summary?: string;
}

export interface JobStatusEvent {
  ts: number;
  jobId: string;
  agentId: string;
  command: string;
  status: JobStatus;
  pid: number;
  exitCode?: number | null;
  durationMs?: number;
  tail?: string;
}

export interface BackboneEventMap {
  "heartbeat:status": HeartbeatStatusEvent;
  "channel:message": ChannelMessageEvent;
  "registry:agents": RegistryChangeEvent;
  "registry:channels": RegistryChangeEvent;
  "registry:adapters": RegistryChangeEvent;
  "cron:job": CronJobEvent;
  "job:status": JobStatusEvent;
}

// --- Typed Event Bus ---

export class BackboneEventBus {
  private emitter = new EventEmitter();
  private lastEvents = new Map<string, unknown>();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  emit<K extends keyof BackboneEventMap>(
    event: K,
    payload: BackboneEventMap[K]
  ): void {
    this.lastEvents.set(event, payload);
    this.emitter.emit(event, payload);
  }

  on<K extends keyof BackboneEventMap>(
    event: K,
    listener: (payload: BackboneEventMap[K]) => void
  ): void {
    this.emitter.on(event, listener as (...args: unknown[]) => void);
  }

  off<K extends keyof BackboneEventMap>(
    event: K,
    listener: (payload: BackboneEventMap[K]) => void
  ): void {
    this.emitter.off(event, listener as (...args: unknown[]) => void);
  }

  getLastEvent<K extends keyof BackboneEventMap>(
    event: K
  ): BackboneEventMap[K] | undefined {
    return this.lastEvents.get(event) as BackboneEventMap[K] | undefined;
  }

  // --- Module event extensions (dynamic keys, untyped payloads) ---

  private moduleListeners: ((key: string, payload: unknown) => void)[] = [];

  /** Subscribe to ALL module events (used by SSE hub). */
  onAnyModuleEvent(listener: (key: string, payload: unknown) => void): void {
    this.moduleListeners.push(listener);
  }

  emitModule(moduleName: string, event: string, payload: unknown): void {
    const key = `module:${moduleName}:${event}`;
    this.lastEvents.set(key, payload);
    this.emitter.emit(key, payload);
    for (const listener of this.moduleListeners) {
      listener(key, payload);
    }
  }

  onModule(
    moduleName: string,
    event: string,
    listener: (payload: unknown) => void
  ): void {
    const key = `module:${moduleName}:${event}`;
    this.emitter.on(key, listener);
  }

  offModule(
    moduleName: string,
    event: string,
    listener: (payload: unknown) => void
  ): void {
    const key = `module:${moduleName}:${event}`;
    this.emitter.off(key, listener);
  }

  getLastModuleEvent(moduleName: string, event: string): unknown {
    return this.lastEvents.get(`module:${moduleName}:${event}`);
  }
}

export const eventBus = new BackboneEventBus();
