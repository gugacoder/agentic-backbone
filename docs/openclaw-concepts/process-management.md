# Process Management

OpenClaw implements a robust process management system that allows agents to execute shell commands in foreground or background, supervise long-running processes, and receive exit notifications. Everything runs as child processes spawned by the gateway — the gateway IS the process supervisor.

## Key Files

| File | Role |
|---|---|
| `src/agents/tools/exec-tool.ts` | `exec` tool definition — spawns commands, handles foreground/background transition |
| `src/agents/tools/process-tool.ts` | `process` tool — manage background sessions (poll, log, write, kill, clear) |
| `src/process/exec.ts` | `runCommandWithTimeout()` — low-level spawn with timeout enforcement |
| `src/process/spawn-utils.ts` | `spawnWithFallback()` — robust spawn with retry on transient errors |
| `src/process/child-process-bridge.ts` | Signal forwarding from parent to child (graceful shutdown) |
| `src/process/command-queue.ts` | Lane-based command queue with concurrency control |

## Design Philosophy

1. **Child processes, not in-process** — Commands run as separate OS processes. A misbehaving script can't crash the gateway.
2. **Gateway as supervisor** — The gateway holds process handles in memory, enforces timeouts, captures output, and notifies agents on exit.
3. **Agent as decision-maker** — The agent decides what to run and what to do with results. The gateway just supervises.
4. **No disk persistence** — Background sessions live in memory. Lost on gateway restart.

## Two Agent Tools

### `exec` — Start a Command

```json
{
  "tool": "exec",
  "command": "npm run build",
  "timeout": 300,
  "yieldMs": 5000,
  "background": false
}
```

| Parameter | Default | Description |
|---|---|---|
| `command` | required | Shell command to execute |
| `timeout` | 1800s (30min) | Kill process after N seconds |
| `yieldMs` | 10000 (10s) | Auto-background after N ms (null = stay foreground) |
| `background` | false | Background immediately (equivalent to yieldMs: 0) |

### `process` — Manage Background Sessions

| Action | Description |
|---|---|
| `list` | List all running and finished sessions |
| `poll` | Drain new output since last poll |
| `log` | Read full log with offset/limit |
| `write` | Send data to stdin |
| `kill` | Send SIGKILL to process |
| `clear` | Remove finished session from memory |

## Execution Modes

### Foreground (Synchronous)

Agent waits for completion. Returns exit code + output.

```
Agent calls exec → spawn child → capture output → child exits → return result
```

### Auto-Background (yieldMs)

Agent waits N milliseconds. If process is still running, transition to background.

```
Agent calls exec → spawn child → wait yieldMs
  → if done: return result (foreground)
  → if still running: markBackgrounded → return { sessionId, status: "running" }
```

The agent receives a `sessionId` and can later use `process poll` to check output.

### Explicit Background

`background: true` — return immediately with sessionId.

```
Agent calls exec(background: true) → spawn child → return { sessionId } immediately
```

## Process Session Lifecycle

```
Spawn → Running (in-memory) → Backgrounded → Exited → Finished → Pruned
```

### Session State

```typescript
interface ProcessSession {
  id: string;                    // Unique session ID
  command: string;               // Original command
  pid?: number;                  // OS process ID
  startedAt: number;             // Timestamp

  // Output (capped at maxOutputChars, default 200k)
  aggregated: string;            // Full output buffer (capped)
  tail: string;                  // Last 2000 chars (quick preview)
  pendingStdout: string[];       // New output since last poll
  pendingStderr: string[];       // New errors since last poll
  truncated: boolean;            // Whether output was truncated

  // State
  exited: boolean;
  exitCode?: number | null;
  exitSignal?: NodeJS.Signals | null;
  backgrounded: boolean;
  notifyOnExit?: boolean;        // Trigger heartbeat on exit
  exitNotified?: boolean;        // Already notified
}
```

### Output Capture

Output is captured in two layers:

- **Aggregated** — Permanent buffer, capped at `maxOutputChars` (200k default). Old content trimmed when cap is exceeded.
- **Pending** — Arrays of chunks since last poll. Cleared on each `process poll` call. Also capped.
- **Tail** — Last 2000 chars of aggregated. Quick preview for status responses.

### Exit and Cleanup

When a child process exits:

1. Mark session as exited (exit code, signal)
2. Move from `runningSessions` to `finishedSessions`
3. Destroy stdio streams (prevent FD leaks)
4. If `notifyOnExit: true` → emit system event + request heartbeat
5. Session stays in memory until TTL expires (default 30min, configurable 1min–3h)
6. Periodic sweeper prunes expired finished sessions

## Exit Notifications (The Wake-Up Mechanism)

When a backgrounded process exits and `notifyOnExit` is enabled:

```typescript
function maybeNotifyOnExit(session, status) {
  if (!session.backgrounded || !session.notifyOnExit || session.exitNotified) return;

  session.exitNotified = true;
  const summary = `Exec ${status} (${session.id.slice(0, 8)}, code ${session.exitCode})`;

  enqueueSystemEvent(summary, { sessionKey });
  requestHeartbeatNow({ reason: `exec:${session.id}:exit` });
}
```

This is the key integration: **the gateway wakes the agent when a job finishes**. The agent doesn't need to poll — it gets a heartbeat trigger with the exit info.

## Timeout Enforcement

Timeouts use two phases:

1. **SIGKILL** — Send kill signal when timeout expires
2. **Finalize** — Wait 1 second for process to exit, then force-finalize

```typescript
const onTimeout = () => {
  killSession(session);  // SIGKILL
  timeoutFinalizeTimer = setTimeout(() => finalizeTimeout(), 1000);
};

if (opts.timeoutSec > 0) {
  timeoutTimer = setTimeout(onTimeout, opts.timeoutSec * 1000);
}
```

Important: backgrounded processes are NOT killed when the agent's tool call is aborted — only the timeout applies.

## Signal Forwarding (child-process-bridge.ts)

When the gateway receives a shutdown signal, it propagates to all child processes:

```typescript
const signals = process.platform === "win32"
  ? ["SIGTERM", "SIGINT", "SIGBREAK"]
  : ["SIGTERM", "SIGINT", "SIGHUP", "SIGQUIT"];

for (const signal of signals) {
  process.on(signal, () => child.kill(signal));
}
```

Auto-detaches when the child exits or errors.

## Command Queue (Lanes)

Work is serialized through lanes to prevent interleaving:

| Lane | Max Concurrent | Purpose |
|---|---|---|
| `main` | 1 | Primary agent workflow |
| `subagent` | 8 | Sub-agent runs |
| `cron` | 1 per job | Scheduled jobs |

```typescript
function enqueueCommandInLane(lane, task, opts): Promise<T> {
  const state = getLaneState(lane);
  state.queue.push({ task, resolve, reject, enqueuedAt: Date.now() });
  drainLane(lane);  // Pump executes tasks up to maxConcurrent
}
```

The pump pattern: while `active < maxConcurrent && queue.length > 0`, shift from queue and execute.

## Spawn Robustness

`spawnWithFallback()` handles transient spawn errors (EBADF on Windows/Docker):

```typescript
async function spawnWithFallback(params) {
  for (const attempt of [primary, ...fallbacks]) {
    try {
      return await spawnAndWaitForSpawn(spawn, argv, attempt.options);
    } catch (err) {
      if (!shouldRetry(err, retryCodes)) throw err;
    }
  }
}
```

## Configuration

| Environment Variable | Default | Range | Description |
|---|---|---|---|
| `PI_BASH_MAX_OUTPUT_CHARS` | 200,000 | 1k–200k | Max aggregated output |
| `OPENCLAW_BASH_PENDING_MAX_OUTPUT_CHARS` | 200,000 | 1k–200k | Max pending output |
| `PI_BASH_YIELD_MS` | 10,000 | 10–120k | Default auto-background threshold |
| `PI_BASH_JOB_TTL_MS` | 1,800,000 | 60k–10.8M | TTL for finished sessions (30min default) |

## What OpenClaw Does NOT Do

- **No PID files on disk** — Everything in memory
- **No disk persistence for jobs** — Gateway restart loses all sessions
- **No process supervisor daemon** — Relies on OS-level service management (systemd, etc.)
- **No resource monitoring** — No CPU/memory tracking per process (just output capture and timeout)
