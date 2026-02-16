// --- Hook Event Names ---

export type HookEventName =
  | "startup"
  | "heartbeat:before"
  | "heartbeat:after"
  | "agent:before"
  | "agent:after"
  | "message:received"
  | "message:sent"
  | "registry:changed";

// --- Hook Contexts ---

export interface HookContext {
  ts: number;
  hookEvent: HookEventName;
  [key: string]: unknown;
}

export interface StartupHookContext extends HookContext {
  hookEvent: "startup";
  port: number;
  agentCount: number;
  channelCount: number;
}

export interface HeartbeatBeforeContext extends HookContext {
  hookEvent: "heartbeat:before";
  agentId: string;
}

export interface HeartbeatAfterContext extends HookContext {
  hookEvent: "heartbeat:after";
  agentId: string;
  status: string;
  preview?: string;
  durationMs?: number;
  reason?: string;
}

export interface AgentBeforeContext extends HookContext {
  hookEvent: "agent:before";
  agentId: string;
  role: string;
  sessionId?: string;
  prompt: string;
}

export interface AgentAfterContext extends HookContext {
  hookEvent: "agent:after";
  agentId: string;
  role: string;
  sessionId?: string;
  resultText: string;
  durationMs: number;
}

export interface MessageReceivedContext extends HookContext {
  hookEvent: "message:received";
  userId: string;
  sessionId: string;
  message: string;
}

export interface MessageSentContext extends HookContext {
  hookEvent: "message:sent";
  userId: string;
  sessionId: string;
  content: string;
}

export interface RegistryChangedContext extends HookContext {
  hookEvent: "registry:changed";
  kind: string;
  reason: string;
  changedPath?: string;
}

export type AnyHookContext =
  | StartupHookContext
  | HeartbeatBeforeContext
  | HeartbeatAfterContext
  | AgentBeforeContext
  | AgentAfterContext
  | MessageReceivedContext
  | MessageSentContext
  | RegistryChangedContext;

// --- Hook Handler + Entry ---

export type HookHandler = (ctx: AnyHookContext) => Promise<void>;

export interface HookEntry {
  slug: string;
  name: string;
  description: string;
  events: HookEventName[];
  priority: number;
  enabled: boolean;
  source: string;
  dir: string;
  handlerPath: string;
  handler: HookHandler | null;
  error?: string;
}
