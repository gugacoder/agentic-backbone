export type ServiceStatus = "running" | "completed" | "failed" | "timeout" | "killed";

export interface ServiceSession {
  id: string;
  agentId?: string;
  slug: string;
  input: Record<string, unknown>;
  cwd: string;
  pid: number;
  startedAt: number;

  // Output (capped at 50k chars)
  stdout: string;
  stderr: string;
  tail: string;
  totalOutputChars: number;
  truncated: boolean;

  // State
  status: ServiceStatus;
  exitCode?: number | null;
  exitSignal?: string | null;
  endedAt?: number;
  durationMs?: number;

  // Config
  timeoutMs: number;

  // Notification (optional)
  channel?: string;
  callback?: string;

  // Internal (not serialized)
  _child?: import("node:child_process").ChildProcess;
  _timeoutTimer?: ReturnType<typeof setTimeout>;
}

export interface InvokeServiceInput {
  slug: string;
  agentId?: string;
  input?: Record<string, unknown>;
  timeout?: number; // seconds, default 300 (5min)
  channel?: string;
  callback?: string;
}

export interface ServiceSummary {
  id: string;
  agentId?: string;
  slug: string;
  pid: number;
  status: ServiceStatus;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  exitCode?: number | null;
  tail: string;
  truncated: boolean;
}

export interface ServiceConfig {
  name: string;
  description: string;
  mode: "script" | "llm";
  model?: string;
  handler?: string;
  prompt?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  bypassable?: boolean;
  schedule?: {
    expr: string;
    tz?: string;
  };
}
