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

export interface NotificationNewEvent {
  ts: number;
  id: number;
  type: string;
  severity: "info" | "warning" | "error";
  agentId?: string;
  title: string;
  body?: string;
}

export interface SessionTakeoverEvent {
  ts: number;
  sessionId: string;
  action: "takeover" | "release";
  takenOverBy: string | null;
}

export interface SessionTitledEvent {
  ts: number;
  sessionId: string;
  agentId: string;
  title: string;
}

export interface ApprovalPendingEvent {
  type: "approval:pending";
  approvalId: number;
  agentId: string;
  sessionId?: string;
  actionLabel: string;
  expiresAt: string;
}

export interface SecurityAlertEvent {
  ts: number;
  agentId: string;
  eventCount: number;
  windowMinutes: number;
}

export interface AgentQuotaExceededEvent {
  ts: number;
  agentId: string;
  quota: string;
  value: number;
}

export interface ConfigVersionChangedEvent {
  agentId: string;
  file: string;
  versionFrom: string | null;
  versionTo: string;
}

export interface CircuitBreakerTrippedEvent {
  ts: number;
  agentId: string;
  reason: string;
  trippedAt: string;
}

export interface CircuitBreakerResumedEvent {
  ts: number;
  agentId: string;
  actor: string | null;
  resumedAt: string;
}

export interface CircuitBreakerKillSwitchEvent {
  ts: number;
  agentId: string;
  active: boolean;
  actor: string;
}

export interface FleetAgentStatusEvent {
  ts: number;
  agentId: string;
  status: "active" | "paused" | "alert" | "killed" | "error";
  health: {
    heartbeatSuccessRate24h: number;
    lastHeartbeat: string | null;
    lastHeartbeatResult: string | null;
    consecutiveFails: number;
  };
  consumption: {
    tokensToday: number;
    costToday: number;
  };
}

export interface FleetAlertEvent {
  ts: number;
  agentId: string;
  alertType: "consecutive_fails" | "circuit_breaker_trip" | "kill_switch";
  message: string;
}

export interface BackboneEventMap {
  "heartbeat:status": HeartbeatStatusEvent;
  "channel:message": ChannelMessageEvent;
  "registry:agents": RegistryChangeEvent;
  "registry:channels": RegistryChangeEvent;
  "registry:adapters": RegistryChangeEvent;
  "cron:job": CronJobEvent;
  "job:status": JobStatusEvent;
  "notification:new": NotificationNewEvent;
  "session:takeover": SessionTakeoverEvent;
  "session:titled": SessionTitledEvent;
  "approval:pending": ApprovalPendingEvent;
  "security:alert": SecurityAlertEvent;
  "agent:quota-exceeded": AgentQuotaExceededEvent;
  "config:version_changed": ConfigVersionChangedEvent;
  "circuit_breaker:tripped": CircuitBreakerTrippedEvent;
  "circuit_breaker:resumed": CircuitBreakerResumedEvent;
  "circuit_breaker:kill_switch": CircuitBreakerKillSwitchEvent;
  "fleet:agent_status": FleetAgentStatusEvent;
  "fleet:alert": FleetAlertEvent;
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
