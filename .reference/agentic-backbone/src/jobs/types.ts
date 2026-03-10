export type JobStatus = "running" | "completed" | "failed" | "timeout" | "killed";

export interface JobSession {
  id: string;
  agentId: string;
  command: string;
  cwd: string;
  pid: number;
  startedAt: number;

  // Output (capped at 200k chars)
  stdout: string;
  stderr: string;
  tail: string;
  totalOutputChars: number;
  truncated: boolean;

  // State
  status: JobStatus;
  exitCode?: number | null;
  exitSignal?: string | null;
  endedAt?: number;
  durationMs?: number;

  // Config
  timeoutMs: number;

  // Wake settings
  wakeMode?: "heartbeat" | "conversation";
  wakeContext?: string;
  sessionId?: string;
  userId?: string;

  // Poll tracking
  _pollOffset?: number;

  // Resource monitoring
  resourceStats?: { cpu: number; memory: number; sampledAt: number };

  // Internal (not serialized)
  _timeoutTimer?: ReturnType<typeof setTimeout>;
  _resourceTimer?: ReturnType<typeof setInterval>;
  _child?: import("node:child_process").ChildProcess;
}

export interface SubmitJobInput {
  agentId: string;
  command: string;
  cwd?: string;
  timeout?: number; // seconds, default 1800 (30min)
  background?: boolean;
  yieldMs?: number;
  wakeMode?: "heartbeat" | "conversation";
  wakeContext?: string;
  sessionId?: string;
  userId?: string;
}

export interface JobSummary {
  id: string;
  agentId: string;
  command: string;
  pid: number;
  status: JobStatus;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  exitCode?: number | null;
  tail: string;
  truncated: boolean;
  resourceStats?: { cpu: number; memory: number; sampledAt: number };
}
