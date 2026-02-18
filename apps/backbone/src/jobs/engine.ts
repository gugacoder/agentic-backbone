import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import pidusage from "pidusage";
import { eventBus } from "../events/index.js";
import { triggerManualHeartbeat } from "../heartbeat/index.js";
import type { JobSession, SubmitJobInput, JobSummary, JobStatus } from "./types.js";

// --- Constants ---

const MAX_OUTPUT_CHARS = 200_000;
const TAIL_CHARS = 2_000;
const JOB_TTL_MS = 30 * 60 * 1000; // 30min
const DEFAULT_TIMEOUT_S = 1800; // 30min
const SWEEP_INTERVAL_MS = 60 * 1000; // 1min

// --- State ---

const runningJobs = new Map<string, JobSession>();
const finishedJobs = new Map<string, JobSession>();
let sweepTimer: ReturnType<typeof setInterval> | null = null;

// --- Output buffering ---

function appendOutput(session: JobSession, stream: "stdout" | "stderr", chunk: string): void {
  session[stream] += chunk;
  session.totalOutputChars += chunk.length;
  if (session[stream].length > MAX_OUTPUT_CHARS) {
    session[stream] = session[stream].slice(-MAX_OUTPUT_CHARS);
    session.truncated = true;
  }
  session.tail = (session.stdout + session.stderr).slice(-TAIL_CHARS);
}

// --- Finalize ---

function finalizeJob(session: JobSession, code: number | null, signal: string | null, statusOverride?: JobStatus): void {
  if (session._timeoutTimer) {
    clearTimeout(session._timeoutTimer);
    session._timeoutTimer = undefined;
  }
  if (session._resourceTimer) {
    clearInterval(session._resourceTimer);
    session._resourceTimer = undefined;
  }

  session.status = statusOverride ?? (code === 0 ? "completed" : "failed");
  session.exitCode = code;
  session.exitSignal = signal;
  session.endedAt = Date.now();
  session.durationMs = session.endedAt - session.startedAt;

  // Destroy stdio
  session._child?.stdout?.destroy();
  session._child?.stderr?.destroy();
  session._child = undefined;

  // Move to finished
  runningJobs.delete(session.id);
  finishedJobs.set(session.id, session);

  console.log(
    `[jobs] ${session.id} ${session.status} (pid=${session.pid}, exit=${code}, signal=${signal}, ${session.durationMs}ms)`
  );

  eventBus.emit("job:status", {
    ts: Date.now(),
    jobId: session.id,
    agentId: session.agentId,
    command: session.command,
    status: session.status,
    pid: session.pid,
    exitCode: code,
    durationMs: session.durationMs,
    tail: session.tail,
  });

  // Wake the agent
  triggerManualHeartbeat(session.agentId).catch((err) =>
    console.error(`[jobs] failed to trigger heartbeat for ${session.agentId}:`, err)
  );
}

// --- Summarize ---

function toSummary(session: JobSession): JobSummary {
  return {
    id: session.id,
    agentId: session.agentId,
    command: session.command,
    pid: session.pid,
    status: session.status,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationMs: session.durationMs,
    exitCode: session.exitCode,
    tail: session.tail,
    truncated: session.truncated,
    resourceStats: session.resourceStats,
  };
}

// --- Public API ---

export function submitJob(input: SubmitJobInput): JobSummary {
  const id = randomUUID();
  const timeoutS = input.timeout ?? DEFAULT_TIMEOUT_S;
  const timeoutMs = timeoutS * 1000;
  const cwd = input.cwd ?? process.cwd();

  const child = spawn(input.command, {
    shell: true,
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
  });

  const session: JobSession = {
    id,
    agentId: input.agentId,
    command: input.command,
    cwd,
    pid: child.pid!,
    startedAt: Date.now(),
    stdout: "",
    stderr: "",
    tail: "",
    totalOutputChars: 0,
    truncated: false,
    status: "running",
    timeoutMs,
    wakeMode: input.wakeMode,
    wakeContext: input.wakeContext,
    sessionId: input.sessionId,
    userId: input.userId,
    _pollOffset: 0,
    _child: child,
  };

  // Capture output
  child.stdout!.on("data", (chunk: Buffer) => {
    appendOutput(session, "stdout", chunk.toString());
  });
  child.stderr!.on("data", (chunk: Buffer) => {
    appendOutput(session, "stderr", chunk.toString());
  });

  // Timeout
  session._timeoutTimer = setTimeout(() => {
    if (session.status === "running") {
      console.log(`[jobs] ${id} timeout after ${timeoutS}s — sending SIGKILL`);
      child.kill("SIGKILL");
      finalizeJob(session, null, "SIGKILL", "timeout");
    }
  }, timeoutMs);

  // On exit
  child.on("exit", (code, signal) => {
    if (session.status === "running") {
      finalizeJob(session, code, signal);
    }
  });

  // On error (spawn failure)
  child.on("error", (err) => {
    if (session.status === "running") {
      session.stderr += `\nSpawn error: ${err.message}`;
      finalizeJob(session, 1, null);
    }
  });

  // Resource sampling (CPU/memory) every 5s
  session._resourceTimer = setInterval(async () => {
    if (session.status !== "running" || !session.pid) return;
    try {
      const stats = await pidusage(session.pid);
      session.resourceStats = { cpu: stats.cpu, memory: stats.memory, sampledAt: Date.now() };
    } catch { /* process may have exited */ }
  }, 5_000);

  runningJobs.set(id, session);
  console.log(`[jobs] submitted ${id} (pid=${child.pid}, agent=${input.agentId}, timeout=${timeoutS}s): ${input.command}`);

  return toSummary(session);
}

export function getJob(jobId: string): JobSummary | null {
  const session = runningJobs.get(jobId) ?? finishedJobs.get(jobId);
  return session ? toSummary(session) : null;
}

export function listJobs(agentId?: string): JobSummary[] {
  const all = [...runningJobs.values(), ...finishedJobs.values()];
  const filtered = agentId ? all.filter((j) => j.agentId === agentId) : all;
  return filtered.map(toSummary);
}

export function killJob(jobId: string): boolean {
  const session = runningJobs.get(jobId);
  if (!session) return false;

  console.log(`[jobs] killing ${jobId} (pid=${session.pid})`);
  session._child?.kill("SIGKILL");

  if (session.status === "running") {
    finalizeJob(session, null, "SIGKILL");
  }
  return true;
}

export function clearJob(jobId: string): boolean {
  return finishedJobs.delete(jobId);
}

// --- Poll / Log / Write ---

export function pollJob(jobId: string): { delta: string; status: JobStatus; done: boolean } | null {
  const session = runningJobs.get(jobId) ?? finishedJobs.get(jobId);
  if (!session) return null;
  const full = session.stdout + session.stderr;
  const offset = session._pollOffset ?? 0;
  const delta = full.slice(offset);
  session._pollOffset = full.length;
  return { delta, status: session.status, done: session.status !== "running" };
}

export function logJob(jobId: string, offset?: number, limit?: number): { log: string; total: number } | null {
  const session = runningJobs.get(jobId) ?? finishedJobs.get(jobId);
  if (!session) return null;
  const full = session.stdout + session.stderr;
  const start = offset ?? 0;
  const maxLen = limit ?? MAX_OUTPUT_CHARS;
  return { log: full.slice(start, start + maxLen), total: full.length };
}

export function writeJob(jobId: string, data: string): boolean {
  const session = runningJobs.get(jobId);
  if (!session || !session._child?.stdin?.writable) return false;
  session._child.stdin.write(data);
  return true;
}

// --- Sweeper ---

export function startJobSweeper(): void {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    const now = Date.now();
    let cleared = 0;
    for (const [id, session] of finishedJobs) {
      if (session.endedAt && now - session.endedAt > JOB_TTL_MS) {
        finishedJobs.delete(id);
        cleared++;
      }
    }
    if (cleared > 0) {
      console.log(`[jobs] sweeper cleared ${cleared} expired job(s)`);
    }
  }, SWEEP_INTERVAL_MS);
}

export function stopJobSweeper(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}

// --- Shutdown ---

export function shutdownAllJobs(): void {
  for (const [id, session] of runningJobs) {
    console.log(`[jobs] shutdown: killing ${id} (pid=${session.pid})`);
    session._child?.kill("SIGKILL");
    if (session.status === "running") {
      session.status = "failed";
      session.endedAt = Date.now();
      session.durationMs = session.endedAt - session.startedAt;
      if (session._timeoutTimer) {
        clearTimeout(session._timeoutTimer);
        session._timeoutTimer = undefined;
      }
      if (session._resourceTimer) {
        clearInterval(session._resourceTimer);
        session._resourceTimer = undefined;
      }
      session._child = undefined;
      runningJobs.delete(id);
      finishedJobs.set(id, session);
    }
  }
}
