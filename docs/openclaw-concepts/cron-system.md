# Cron System

The cron system is a persistent job scheduler that enables agents to execute tasks on a schedule — one-shot, recurring interval, or classic cron expressions. Each job either injects a system event into the main session or spawns an isolated agent turn with optional delivery to external channels (Slack, Telegram, Discord, WhatsApp, etc.).

## Key Files

| File | Role |
|---|---|
| `src/cron/service.ts` | Public API surface (`CronService` class) |
| `src/cron/service/ops.ts` | Core operations: start, stop, add, update, remove, run, list |
| `src/cron/service/state.ts` | Service state and types |
| `src/cron/service/timer.ts` | Scheduling logic, timer management, job execution loop |
| `src/cron/service/jobs.ts` | Job lifecycle, next-run computation, error backoff |
| `src/cron/service/store.ts` | Persistence and loading (JSON file) |
| `src/cron/service/locked.ts` | Concurrency control via promise chaining |
| `src/cron/types.ts` | All TypeScript types and interfaces |
| `src/cron/schedule.ts` | Next-run calculation (uses croner library) |
| `src/cron/normalize.ts` | Data normalization and validation |
| `src/cron/store.ts` | File I/O (atomic write-then-rename) |
| `src/cron/isolated-agent/run.ts` | Isolated agent turn execution (~620 lines) |
| `src/cron/isolated-agent/session.ts` | Session creation for cron runs |
| `src/cron/isolated-agent/delivery-target.ts` | Delivery channel and recipient resolution |
| `src/cron/isolated-agent/helpers.ts` | Payload extraction, heartbeat detection |
| `src/cron/delivery.ts` | Delivery plan resolution |
| `src/cron/session-reaper.ts` | Session cleanup (configurable retention, default 24h) |
| `src/cron/run-log.ts` | Persistent JSONL run history per job |
| `src/cron/parse.ts` | ISO 8601 timestamp parsing |
| `src/cron/payload-migration.ts` | Legacy payload field migration |
| `src/cron/config/types.cron.ts` | Configuration types |
| `src/agents/tools/cron-tool.ts` | Agent-facing tool interface (`cron.*`) |
| `src/cli/cron-cli.ts` | CLI entry point |
| `src/cli/cron-cli/*.ts` | CLI subcommands (add, edit, list, remove, run, runs, status) |

## Lifecycle of a Cron Job

```
Service Start
      |
      v
Load jobs.json (force reload)
      |
      v
Clear stale runningAtMs markers (>2h)
      |
      v
Run missed jobs (nextRunAtMs <= now, not already completed one-shots)
      |
      v
Recompute all nextRunAtMs → persist → arm timer
      |
      v
Timer fires (max 60s delay to prevent drift)
      |
      v
  onTimer()
    1. If already executing, re-arm 60s later (prevent starvation)
    2. Force-reload store (catch cross-service edits)
    3. Find due jobs (enabled + not running + now >= nextRunAtMs)
    4. Mark runningAtMs = now → persist
    5. Execute each job (up to maxConcurrentRuns)
    6. Apply results (backoff / disable / delete)
    7. Recompute nextRunAtMs → persist
    8. Sweep session reaper (self-throttled, every 5 min)
    9. Re-arm timer for next earliest job
```

## Job Definition

A `CronJob` record contains:

```typescript
{
  id: string;                          // UUID
  agentId?: string;                    // Optional agent binding
  name: string;                        // Display name
  description?: string;
  enabled: boolean;
  deleteAfterRun?: boolean;            // Auto-delete one-shot jobs after success
  createdAtMs: number;
  updatedAtMs: number;
  schedule: CronSchedule;             // When to run
  sessionTarget: "main" | "isolated"; // Where to run
  wakeMode: "now" | "next-heartbeat"; // Main jobs only
  payload: CronPayload;               // What to do
  delivery?: CronDelivery;            // Isolated jobs only
  state: CronJobState;                // Runtime state
}
```

## Three Schedule Kinds

### `at` — One-Shot

Fires once at an absolute timestamp, then auto-deletes (by default).

```typescript
{ kind: "at", at: "2026-02-01T16:00:00Z" }
```

- ISO 8601 timestamps. UTC when no timezone suffix is provided.
- If the timestamp is in the past, `nextRunAtMs` is `undefined` and the job stays disabled.
- `deleteAfterRun` defaults to `true` for `at` schedules.

### `every` — Fixed Interval

Fires every N milliseconds, anchored to a reference time.

```typescript
{ kind: "every", everyMs: 30000, anchorMs?: number }
```

- `anchorMs` defaults to `createdAtMs` if omitted.
- Next run: `anchor + ceil((now - anchor) / everyMs) * everyMs` — always strictly in the future.

### `cron` — 5-Field Expression

Standard cron expressions with optional timezone.

```typescript
{ kind: "cron", expr: "0 7 * * *", tz?: "America/Los_Angeles" }
```

- Uses the **croner** library.
- Defaults to host timezone if `tz` is omitted.
- Operates at second granularity. `now` is floored to the current second and croner returns the next occurrence *strictly after* that second — preventing duplicate fires within the same tick.

## Payload Types

### systemEvent (main session only)

Injects a text event into the main agent session.

```typescript
{ kind: "systemEvent", text: "Reminder: check inbox" }
```

### agentTurn (isolated session only)

Spawns a full isolated agent turn with optional overrides.

```typescript
{
  kind: "agentTurn",
  message: string,                      // Required prompt
  model?: string,                       // Model override (e.g., "opus")
  thinking?: string,                    // Thinking level override
  timeoutSeconds?: number,              // Execution timeout override
  allowUnsafeExternalContent?: boolean  // Skip security wrapping for external hooks
}
```

## Delivery Configuration (Isolated Jobs Only)

Controls whether and where the agent's response is delivered after execution.

```typescript
{
  mode: "none" | "announce",   // "announce" posts to channel, "none" internal only
  channel?: "last" | ChannelId, // Target channel (default "last")
  to?: string,                  // Channel-specific recipient
  bestEffort?: boolean          // Don't fail job if delivery fails
}
```

Delivery is skipped when:
- The agent replied with only `HEARTBEAT_OK` (within `ackMaxChars` limit).
- A messaging tool already sent the response to the target channel during execution.

## Job State Tracking

```typescript
{
  nextRunAtMs?: number,           // When job should run next
  runningAtMs?: number,           // When execution started (marks in-flight)
  lastRunAtMs?: number,           // Timestamp of last execution
  lastStatus?: "ok" | "error" | "skipped",
  lastError?: string,
  lastDurationMs?: number,
  consecutiveErrors?: number,     // For exponential backoff
  scheduleErrorCount?: number     // Auto-disables after 3 consecutive errors
}
```

## Execution Modes

### Main Session Jobs

1. Extract text from `systemEvent` payload (must be non-empty; otherwise skipped).
2. Enqueue system event into the main session.
3. If `wakeMode: "now"` — call `runHeartbeatOnce()` with retry logic (up to 2 min wait) and wait for completion.
4. If `wakeMode: "next-heartbeat"` — request heartbeat without waiting.

### Isolated Agent Jobs

1. **Agent resolution** — Use job's `agentId` or fallback to default agent.
2. **Model selection** — Priority: job payload override → hook model → agent config default → `DEFAULT_MODEL`.
3. **Thinking level** — Priority: job payload override → hook thinking → agent default → model default.
4. **Session creation** — Ephemeral session key: `<agentMainKey>:run:<uuid>`. Fresh per run (no context carry-over).
5. **Security wrapping** — External hook sessions (Gmail, webhooks) get content wrapped with security boundaries unless `allowUnsafeExternalContent` is set.
6. **Prompt assembly** — `[cron:<jobId> <jobName>] <message>` + timestamp + delivery instructions.
7. **Agent execution** — Model fallback chain, configurable timeout (default 10 min), collects text + media payloads.
8. **Post-execution** — Update session with token usage, extract summary, determine delivery eligibility.
9. **Delivery** — Route to outbound channel adapter. Best-effort mode prevents delivery failures from failing the job.

## Error Handling

### Backoff Schedule (Recurring Jobs)

On consecutive execution errors, the next run is delayed:

| Consecutive Errors | Delay |
|---|---|
| 1 | 30 seconds |
| 2 | 1 minute |
| 3 | 5 minutes |
| 4 | 15 minutes |
| 5+ | 60 minutes |

After a successful run, the counter resets to 0.

### One-Shot Job Errors

One-shot (`at`) jobs are disabled after any terminal status — ok, error, or skipped. They never re-fire a past timestamp.

### Schedule Computation Errors

If `nextRunAtMs` computation fails 3 consecutive times, the job is auto-disabled. The counter resets on any successful computation.

### Stuck Job Recovery

Jobs with `runningAtMs` older than 2 hours are considered stuck. The marker is cleared on the next `recomputeNextRuns()` pass, allowing the job to be picked up again.

## Concurrency Control

### Promise Chain Locking (`locked.ts`)

There are no file locks. All operations on a store serialize through a promise chain:

```typescript
const storeLocks = new Map<string, Promise<void>>();

async function locked<T>(state, fn) {
  const storeOp = storeLocks.get(storePath) ?? Promise.resolve();
  const next = Promise.all([state.op, storeOp]).then(fn);
  state.op = resolveChain(next);
  storeLocks.set(storePath, resolveChain(next));
  return next;
}
```

Errors in one operation don't block subsequent ones (via `resolveChain` which catches and resolves).

### Store Loading Strategy

- In-memory copy after first load — fast path for reads.
- Force reload on every timer tick — catches external edits to `jobs.json`.
- Atomic write-then-rename pattern with `.bak` backup on each persist.

## Persistence

### Job Store

- **Path**: `~/.openclaw/cron/jobs.json`
- **Format**: JSON with version marker

```typescript
type CronStoreFile = {
  version: 1;
  jobs: CronJob[];
};
```

- Uses JSON5 for lenient parsing on load.
- Atomic writes via temporary file + rename.
- Auto-creates `.bak` file on each write.

### Run History

- **Path**: `~/.openclaw/cron/runs/<jobId>.jsonl`
- One JSONL entry per completed run.
- Auto-prunes when file exceeds 2 MB (keeps last 2000 lines).
- Queryable via `cron.runs` API.

### Session Reaper

- Runs on timer tick, self-throttled to 5-minute intervals.
- Deletes ephemeral cron run sessions older than the retention period.
- Default retention: 24 hours.
- Configurable via `cron.sessionRetention` (e.g., `"7d"`, `"1h30m"`, or `false` to disable).

## Configuration

### Config Structure (`.openclaw/config.json`)

```typescript
type CronConfig = {
  enabled?: boolean;              // Default: true
  store?: string;                 // Default: ~/.openclaw/cron/jobs.json
  maxConcurrentRuns?: number;     // Default: 1
  sessionRetention?: string | false;  // Default: "24h"
};
```

### Environment Variables

- `OPENCLAW_SKIP_CRON=1` — Disables the cron system entirely.

### Service Dependencies

The cron service receives its dependencies via `CronServiceDeps`:

| Dependency | Purpose |
|---|---|
| `nowMs()` | Clock function (defaults to `Date.now`) |
| `log` | Logger instance |
| `storePath` | Path to `jobs.json` |
| `cronEnabled` | Boolean flag |
| `defaultAgentId` | Fallback agent for jobs without `agentId` |
| `enqueueSystemEvent()` | Inject event into main session |
| `requestHeartbeatNow()` | Wake the heartbeat system |
| `runHeartbeatOnce()` | Run heartbeat synchronously (for `wakeMode: "now"`) |
| `runIsolatedAgentJob()` | Execute an isolated agent turn |
| `resolveSessionStorePath()` | Per-agent session storage path |
| `onEvent()` | Event callback for run lifecycle |

## Next-Run Computation

### Two Recompute Strategies

1. **Full recompute** (`recomputeNextRuns`) — Clears stuck markers, recomputes all jobs (even those with future `nextRunAtMs`). Used after mutations and execution.
2. **Maintenance-only** (`recomputeNextRunsForMaintenance`) — Only clears stuck markers and computes missing `nextRunAtMs`. Never overwrites future values. Used on timer ticks when no jobs were due.

### State Transitions

```
Job Enabled + Valid Schedule
  ↓
computeJobNextRunAtMs() → nextRunAtMs
  ↓
[ Timer Tick ]
  ↓
now >= nextRunAtMs?
  ├─ YES → Execute
  └─ NO  → Maintenance recompute if past-due
  ↓
applyJobResult()
  ├─ ok      → nextRunAtMs = next occurrence
  ├─ error   → nextRunAtMs = max(next occurrence, now + backoff)  [recurring]
  ├─ error   → enabled = false, nextRunAtMs = undefined           [one-shot]
  └─ skipped → similar to ok
```

## Agent Tool Interface

Exposed as `cron.*` tools available to agents:

| Tool | Description |
|---|---|
| `cron.status` | Get scheduler status |
| `cron.list` | List jobs (optionally filter disabled) |
| `cron.add` | Create a new job |
| `cron.update` | Patch an existing job |
| `cron.remove` | Delete a job |
| `cron.run` | Execute a job immediately (force or due) |
| `cron.runs` | Query run history |
| `cron.wake` | Immediate system event + optional heartbeat trigger |

## CLI Interface

```bash
openclaw cron add      # Create job
openclaw cron edit     # Update job
openclaw cron list     # List jobs
openclaw cron remove   # Delete job
openclaw cron run      # Execute job immediately
openclaw cron runs     # View run history
openclaw cron status   # Check scheduler status
```

### Scheduling Flags

```bash
--at "2026-02-01T16:00:00Z"     # One-shot
--every "30m"                    # Interval (human duration)
--cron "0 7 * * *"              # Cron expression
--tz "America/Los_Angeles"      # Timezone for cron expressions
```

### Session & Payload Flags

```bash
--session main|isolated
--system-event "Reminder text"   # For main session
--message "Summarize updates"    # For isolated session
```

### Execution Control Flags

```bash
--wake now|next-heartbeat
--delete-after-run               # Auto-delete one-shot (default for at)
--keep-after-run                 # Don't delete after run
```

### Model & Delivery Flags

```bash
--model "opus"                   # Model override
--thinking "high"                # Thinking level override
--announce                       # Deliver response to channel
--no-deliver                     # Internal only
--channel slack|telegram|etc     # Target channel
--to "<recipient>"               # Channel-specific recipient
--best-effort                    # Don't fail on delivery error
```

## Examples

### One-Shot Reminder (Main Session)

```bash
openclaw cron add \
  --name "Reminder" \
  --at "2026-02-01T16:00:00Z" \
  --session main \
  --system-event "Time to review the draft" \
  --wake now \
  --delete-after-run
```

### Daily Report (Isolated + Delivery)

```bash
openclaw cron add \
  --name "Morning brief" \
  --cron "0 7 * * *" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --message "Summarize overnight updates" \
  --announce \
  --channel slack \
  --to "channel:C1234567890"
```

### Telegram Topic Delivery

```bash
openclaw cron add \
  --name "Nightly summary" \
  --cron "0 22 * * *" \
  --session isolated \
  --message "Write a summary of today" \
  --announce \
  --channel telegram \
  --to "-1001234567890:topic:123"
```

## Integration Points

### With the Heartbeat System

- Main session jobs enqueue events and request heartbeat wakes.
- `wakeMode: "now"` triggers `runHeartbeatOnce()` synchronously.
- Isolated job summaries are posted to the main session via heartbeat request.

### With the Agent System

- Reads agent config for model defaults, workspace, and skills.
- Resolves agent directories and model catalogs.
- Supports per-job agent binding via `agentId`.

### With the Delivery System

- Integrated outbound channel adapters (Telegram, Slack, Discord, WhatsApp, Signal).
- Thread ID tracking (Telegram topics, Slack threads).
- Best-effort mode for fault tolerance.

### With the Session System

- Per-agent session stores.
- Model and provider overrides per session.
- Skills snapshot caching.
- Token usage tracking per run.

## Summary

The cron system is a persistent, fault-tolerant job scheduler that:
- Supports three schedule kinds: one-shot (`at`), interval (`every`), and cron expressions (`cron`).
- Runs jobs in two modes: main session (system events + heartbeat wake) or isolated agent turns.
- Delivers agent responses to external channels with best-effort resilience.
- Handles errors with exponential backoff for recurring jobs and auto-disable for one-shots.
- Persists state atomically with backup, recovers missed jobs on startup, and clears stuck markers.
- Provides both an agent tool interface (`cron.*`) and a CLI for management.
- Integrates tightly with the heartbeat, agent, delivery, and session subsystems.
