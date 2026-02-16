# Hot Reload System

OpenClaw implements a **distributed file watching architecture** — each subsystem owns its own watcher rather than relying on a single central observer. All watchers use chokidar with debouncing and write stabilization.

---

## 1. Configuration Hot Reload (Gateway)

**Source:** `src/gateway/config-reload.ts`

Watches `~/.openclaw/openclaw.json`. Uses a **rule-matching engine** to classify every changed config path as `hot`, `restart`, or `none`.

```
Config file change → diff old vs new → match changed paths against rules → build reload plan → execute
```

### Reload modes

| Mode | Behavior |
|------|----------|
| `hybrid` (default) | Hot-applies safe changes, auto-restarts for critical ones |
| `hot` | Hot-applies only, logs warning if restart needed |
| `restart` | Restarts gateway on any change |
| `off` | No watching |

### What's safe (hot) vs. requires restart

| Safe (hot) | Restart required |
|---|---|
| `agents`, `agent`, `models`, `routing` | `gateway.*` (port, bind, TLS, auth) |
| `channels`, `web` | `discovery` |
| `hooks`, `cron`, `browser` | `canvasHost` |
| `tools`, `skills`, `audio`, `talk` | `plugins` |
| `session`, `messages`, `ui`, `logging` | |

**Exception:** `gateway.reload` and `gateway.remote` don't trigger restart.

### Hot reload actions

Each hot change can trigger targeted subsystem restarts:

- `reload-hooks` — Recompute hooks config
- `restart-heartbeat` — Update heartbeat config in-place
- `restart-cron` — Stop old cron, start new
- `restart-browser-control` — Restart browser automation
- `restart-gmail-watcher` — Restart Gmail webhook listener
- `restart-channel:<id>` — Restart specific channel (WhatsApp, Telegram, etc.)

### Timing

- Chokidar write stabilization: 200ms (poll 50ms)
- Debounce: 300ms (configurable via `gateway.reload.debounceMs`)

---

## 2. Skills Hot Reload

**Source:** `src/agents/skills/refresh.ts`

Watches skill directories and bumps a version counter on change. Agents check the version and reload when stale.

### Watched paths

```
workspace/skills/
~/.openclaw/skills/          (shared)
config.skills.load.extraDirs (additional)
plugin skill directories
```

Ignores `.git`, `node_modules`, `dist`, Python venvs/caches, `build`, `.cache`.

### Change flow

```
File add/change/unlink → debounce (250ms) → bump version → notify listeners
```

Version is timestamp-based — uses `Date.now()`, incrementing if collisions occur. Listeners registered via `registerSkillsChangeListener()` receive a `SkillsChangeEvent` with `workspaceDir`, `reason`, and `changedPath`.

### Config

```jsonc
{
  "skills": {
    "load": {
      "watch": true,             // default: true
      "watchDebounceMs": 250     // default: 250
    }
  }
}
```

---

## 3. Memory System Watching

**Source:** `src/memory/manager.ts`

Two independent mechanisms feed the memory sync pipeline:

### File watcher (MEMORY.md + memory directory)

Watches:
- `workspace/MEMORY.md` (and `memory.md`)
- `workspace/memory/` directory
- `config.memorySearch.extraPaths`

On change, marks the manager as dirty and schedules a debounced sync:

```
File change → markDirty() → scheduleWatchSync() → debounce → sync({ reason: "watch" })
```

### Session transcript listener (event-based)

Subscribes to `onSessionTranscriptUpdate` events (not file watching). Batches pending session files with a 5-second debounce (`SESSION_DIRTY_DEBOUNCE_MS`).

```
Session transcript update → scheduleSessionDirty() → batch (5s) → processSessionDeltaBatch()
```

### Interval sync

Optional periodic sync via `sync.intervalMinutes` config (e.g., every hour). Catches anything missed by watch/events.

### Config

```jsonc
{
  "memorySearch": {
    "sync": {
      "watch": true,
      "watchDebounceMs": 1500,
      "onSessionStart": true,
      "onSearch": true,
      "intervalMinutes": 60
    }
  }
}
```

---

## 4. Canvas Host Live Reload

**Source:** `src/canvas-host/server.ts`

Watches the canvas root directory (default: `~/.openclaw/state/canvas`) for HTML/CSS/JS changes. Broadcasts `"reload"` via WebSocket to connected browser clients.

### Timing

- Write stabilization: 75ms (poll 10ms)
- Broadcast debounce: 75ms

Intentionally fast for interactive UI development feedback.

### Config

Enabled by default. Disable via `canvasHost.liveReload = false`.

---

## 5. Architecture Summary

| Subsystem | Source | Watches | Debounce | Mechanism |
|---|---|---|---|---|
| **Config** | `gateway/config-reload.ts` | `openclaw.json` | 300ms | Chokidar → rule engine → hot/restart |
| **Skills** | `agents/skills/refresh.ts` | `skills/` dirs | 250ms | Chokidar → version bump → listeners |
| **Memory files** | `memory/manager.ts` | `MEMORY.md`, `memory/` | configurable | Chokidar → dirty flag → async sync |
| **Memory sessions** | `memory/manager.ts` | session transcripts | 5000ms | Event emitter → batch processing |
| **Canvas** | `canvas-host/server.ts` | canvas root dir | 75ms | Chokidar → WebSocket broadcast |

### Common patterns

1. **Debounce + write stabilization** — All watchers use chokidar's `awaitWriteFinish` to avoid partial reads, plus application-level debouncing to coalesce rapid changes.

2. **Listener registration** — Subsystems expose `register*Listener()` functions returning unsubscribe callbacks.

3. **Resilient error handling** — Watcher failures (e.g., fd exhaustion) gracefully disable watching with a warning, never crash the process.

4. **Config-driven** — Every watcher can be disabled and its debounce tuned via config.
