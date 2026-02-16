# OpenClaw Hooks System

The hooks system is OpenClaw's event-driven automation framework. It lets developers extend the platform's behavior by running custom code in response to specific events — commands, agent lifecycle, gateway startup, tool invocations, and more — without modifying OpenClaw's core source.

OpenClaw ships **two complementary hook subsystems**:

| Subsystem | Scope | Execution Model | Use Case |
|---|---|---|---|
| **Internal Hooks** | Commands, bootstrap, gateway | Async event-stream | Reacting to user commands, injecting bootstrap files, running startup tasks |
| **Plugin Hooks** | Agent execution, messages, tools | Sync + async, priority-ordered | Modifying system prompts, intercepting tool calls, transforming messages |

---

## Hook Definition

Each internal hook is a directory containing a `HOOK.md` file and a handler module. The file has YAML frontmatter (metadata) followed by markdown content (documentation).

```
my-hook/
  HOOK.md        # Metadata + documentation (required)
  handler.ts     # Handler implementation (required)
```

### Frontmatter Schema

```yaml
---
name: my-hook
description: "Short description of what this hook does"
homepage: https://docs.openclaw.ai/hooks#my-hook
metadata:
  {
    "openclaw": {
      "emoji": "...",
      "hookKey": "custom-key",
      "events": ["command:new", "command:reset"],
      "export": "default",
      "requires": {
        "bins": ["node", "git"],
        "anyBins": ["python", "python3"],
        "env": ["MY_API_KEY"],
        "config": ["workspace.dir"]
      },
      "os": ["linux", "darwin"],
      "always": false,
      "install": [
        { "id": "bundled", "kind": "bundled", "label": "Bundled with OpenClaw" }
      ]
    }
  }
---
```

| Field | Purpose |
|---|---|
| `name` | Unique hook identifier (falls back to directory name) |
| `description` | Short description shown in listings |
| `metadata.openclaw.events` | Events this hook listens to (e.g. `command:new`, `gateway:startup`) |
| `metadata.openclaw.export` | Named export from handler module (defaults to `default`) |
| `metadata.openclaw.hookKey` | Custom config lookup key (defaults to hook name) |
| `metadata.openclaw.emoji` | Icon for CLI display |
| `metadata.openclaw.requires` | Environment requirements (bins, env vars, config paths) |
| `metadata.openclaw.os` | Restrict to platforms (`darwin`, `linux`, `win32`) |
| `metadata.openclaw.always` | Bypass eligibility checks if `true` |
| `metadata.openclaw.install` | Automated install options for missing dependencies |

### Handler Implementation

Handlers are async functions that receive an `InternalHookEvent`:

```typescript
import type { HookHandler } from "../../hooks.js";

const myHandler: HookHandler = async (event) => {
  if (event.type !== "command" || event.action !== "new") return;

  try {
    const cfg = event.context.cfg as OpenClawConfig;
    const sessionKey = event.sessionKey;

    // Do work...

    // Optionally send a message back to the user
    event.messages.push("Hook executed successfully.");
  } catch (err) {
    console.error("[my-hook] Error:", err instanceof Error ? err.message : String(err));
  }
};

export default myHandler;
```

### Core Type Definitions

```
src/hooks/types.ts            – Hook, HookEntry, HookSnapshot, OpenClawHookMetadata, HookInvocationPolicy
src/hooks/internal-hooks.ts   – InternalHookEvent, InternalHookEventType, InternalHookHandler
src/hooks/frontmatter.ts      – ParsedHookFrontmatter, parsing logic
```

Key types:

- **`InternalHookEvent`** — the event object passed to every handler. Contains `type`, `action`, `sessionKey`, `timestamp`, `context`, and a mutable `messages[]` array.
- **`HookEntry`** — a loaded hook plus its parsed frontmatter, OpenClaw metadata, and invocation policy.
- **`HookSnapshot`** — the hook registry snapshot, used for status reporting and CLI display.
- **`HookInvocationPolicy`** — resolved enabled/disabled state from config and frontmatter.

---

## Internal Hooks

### Event Types

Internal hooks react to four event categories, each with specific actions:

| Event Type | Event Action | Trigger Point | Purpose |
|---|---|---|---|
| `command` | `new` | `/new` command issued | React to session creation |
| `command` | `reset` | `/reset` command issued | React to session reset |
| `command` | `stop` | `/stop` command issued | React to agent stop |
| `agent` | `bootstrap` | Before workspace files injected | Mutate bootstrap files before agent starts |
| `gateway` | `startup` | After channels + hooks loaded | Run startup tasks |

Handlers can register for a general type (`command`) or a specific action (`command:new`). When an event fires, **both** general and specific handlers run.

### Event Object

```typescript
interface InternalHookEvent {
  type: "command" | "session" | "agent" | "gateway";
  action: string;                     // e.g., "new", "reset", "bootstrap", "startup"
  sessionKey: string;                 // Session identifier
  timestamp: Date;
  messages: string[];                 // Mutable — handlers push messages here
  context: Record<string, unknown>;   // Event-specific payload
}
```

The `context` object varies by event:

- **Command events** — `sessionEntry`, `previousSessionEntry`, `commandSource`, `senderId`, `cfg`
- **Bootstrap events** — `bootstrapFiles` (mutable array), `workspaceDir`, `agentId`, `sessionKey`
- **Gateway events** — `cfg`, `deps`, `workspaceDir`

### Registration & Triggering

```typescript
// Register a handler for an event key
registerInternalHook("command:new", myHandler);

// Trigger — runs all matching handlers sequentially
const event = createInternalHookEvent("command", "new", sessionKey, { cfg, ... });
await triggerInternalHook(event);
// event.messages now contains any messages pushed by handlers
```

When triggered, the system collects handlers for both the general type (`command`) and the specific key (`command:new`), then runs them sequentially. Errors in one handler are caught and logged — they do not prevent other handlers from running.

---

## Plugin Hooks

Plugin hooks are the second subsystem, tightly integrated with agent execution. They are registered through the plugin system rather than file discovery.

### Hook Categories

#### Void Hooks (fire-and-forget, parallel execution)

| Hook Name | When It Fires |
|---|---|
| `agent_end` | After agent conversation completes |
| `before_compaction` | Before session compaction |
| `after_compaction` | After session compaction |
| `message_received` | When a message arrives |
| `message_sent` | After a message is sent |
| `after_tool_call` | After a tool call completes |
| `gateway_start` | When the gateway starts |
| `gateway_stop` | When the gateway stops |

#### Modifying Hooks (sequential, result-chaining)

| Hook Name | When It Fires | What It Can Modify |
|---|---|---|
| `before_agent_start` | Before agent run begins | Inject context into system prompt |
| `message_sending` | Before sending a message | Modify or cancel the outgoing message |
| `before_tool_call` | Before a tool is invoked | Modify parameters or block the call |

#### Synchronous Hook (hot-path optimization)

| Hook Name | When It Fires | Why Synchronous |
|---|---|---|
| `tool_result_persist` | Before tool result is persisted to session transcript | Runs in the hot path — must be synchronous to avoid blocking the event loop |

### Priority System

Plugin hooks support a `priority` field. Higher priority handlers run first. This allows plugins to control execution order when multiple plugins hook into the same event.

---

## Discovery & Loading

**File:** `src/hooks/workspace.ts`

Internal hooks are discovered from three locations, with later sources overriding earlier ones:

| Priority | Source | Path |
|---|---|---|
| 1 (lowest) | Bundled hooks | `<openclaw>/dist/hooks/bundled/` |
| 2 | Managed hooks | `~/.openclaw/hooks/` |
| 3 (highest) | Workspace hooks | `<workspace>/hooks/` |

Additional directories can be configured via `hooks.internal.load.extraDirs`.

### Loading Process

**File:** `src/hooks/loader.ts`

1. Scan all hook directories for `HOOK.md` files
2. Parse frontmatter to extract metadata and event bindings
3. Filter by eligibility (see below)
4. Dynamically import handler modules (with cache-busting)
5. Register each handler for its declared events

### Legacy Configuration

Hooks can also be registered directly in config without file discovery:

```json
{
  "hooks": {
    "internal": {
      "handlers": [
        {
          "event": "command:new",
          "module": "./hooks/handlers/my-handler.ts",
          "export": "default"
        }
      ]
    }
  }
}
```

---

## Eligibility & Filtering

**File:** `src/hooks/config.ts`

After discovery, each hook is checked for eligibility. A hook is **excluded** if any of these fail:

1. **Explicitly disabled** — `hooks.internal.entries.<name>.enabled: false` in config
2. **OS mismatch** — `metadata.openclaw.os` doesn't include current platform
3. **Missing binaries** — `requires.bins` not all found on PATH
4. **Missing any-of binaries** — none of `requires.anyBins` found on PATH
5. **Missing env vars** — `requires.env` not set in `process.env`
6. **Missing config** — `requires.config` paths not truthy in app config

Exception: hooks with `always: true` bypass all checks after OS filtering.

### Status Tracking

**File:** `src/hooks/hooks-status.ts`

Each hook's status is tracked with detail about why it is or isn't eligible — disabled, missing deps (which bins, which env vars, etc.), and available install options.

---

## Configuration

```json5
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "session-memory": {
          "enabled": true,
          "messages": 25            // Hook-specific config
        },
        "command-logger": {
          "enabled": false
        },
        "my-hook": {
          "enabled": true,
          "env": {
            "MY_VAR": "value"
          }
        }
      },
      "load": {
        "extraDirs": ["/path/to/more/hooks"]
      }
    }
  }
}
```

Per-hook config is accessible at runtime via `resolveHookConfig(hookKey, cfg)`.

---

## Integration Points

### Command Handling

**File:** `src/auto-reply/reply/commands-core.ts`

When a user issues `/new`, `/reset`, or `/stop`:

```
Command received → Authorize sender → HOOKS TRIGGER → Send hook messages → Process command
```

Hooks fire **after** authorization but **before** the command is processed. Any messages pushed to `event.messages` are sent back to the user.

### Agent Bootstrap

**File:** `src/agents/bootstrap-hooks.ts`

Before workspace files are injected into an agent's context, bootstrap hooks can **mutate the file list**:

```typescript
const event = createInternalHookEvent("agent", "bootstrap", sessionKey, {
  bootstrapFiles: files,   // Mutable — hooks can add, remove, or modify entries
  workspaceDir,
  agentId,
});
await triggerInternalHook(event);
// event.context.bootstrapFiles may have been modified
```

### Gateway Startup

**File:** `src/gateway/server-startup.ts`

After channels are initialized and hooks are loaded, a `gateway:startup` event fires (with a 250ms delay to let other initialization settle).

### Tool Result Persistence

**File:** `src/agents/session-tool-result-guard-wrapper.ts`

The `tool_result_persist` plugin hook transforms tool results before they're written to the session transcript. This hook is **synchronous** because it runs in the hot path.

---

## Bundled Hooks

OpenClaw ships with three hooks:

### session-memory

**Events:** `command:new`

Saves context from the previous session when a new one is created.

1. Reads the last N messages from the ending session
2. Uses an LLM to generate a descriptive slug (e.g. `vendor-pitch`, `api-design`)
3. Writes metadata to `<workspace>/memory/YYYY-MM-DD-slug.md`

**Config:**

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "session-memory": {
          "enabled": true,
          "messages": 25,
          "llmSlug": true
        }
      }
    }
  }
}
```

### command-logger

**Events:** `command` (all commands)

Appends a JSONL entry to `~/.openclaw/logs/commands.log` for every command event:

```jsonl
{"timestamp":"2026-01-16T14:30:00.000Z","action":"new","sessionKey":"agent:main:main","senderId":"+1234567890","source":"telegram"}
```

### boot-md

**Events:** `gateway:startup`

Reads `BOOT.md` from the workspace and runs its instructions through the agent runner at gateway startup. Useful for initializing workspace state.

---

## Lifecycle Summary

```
DEFINITION          A HOOK.md file with frontmatter + a handler module
     |
DISCOVERY           Loaded from 3 precedence-ordered locations (bundled → managed → workspace)
     |
FILTERING           Checked against enabled/OS/bins/env/config requirements
     |
REGISTRATION        Eligible handlers registered for their declared events
     |
EXECUTION           Event fires → all matching handlers run sequentially
                    Handlers receive event object with mutable messages[] and context
     |
RESPONSE            Messages pushed by handlers are sent back to the user
```

---

## Key Source Files

| File | Purpose |
|---|---|
| `src/hooks/types.ts` | Core type definitions (Hook, HookEntry, HookSnapshot) |
| `src/hooks/internal-hooks.ts` | Event types, registration, and triggering |
| `src/hooks/hooks.ts` | Re-exports for the internal hooks API |
| `src/hooks/workspace.ts` | Directory scanning, loading entries from all sources |
| `src/hooks/loader.ts` | Dynamic module import with cache-busting |
| `src/hooks/config.ts` | Eligibility checks and per-hook config resolution |
| `src/hooks/frontmatter.ts` | YAML frontmatter parsing and metadata extraction |
| `src/hooks/hooks-status.ts` | Status tracking and diagnostics |
| `src/hooks/bundled/session-memory/` | Bundled hook: saves session context on `/new` |
| `src/hooks/bundled/command-logger/` | Bundled hook: logs all commands to JSONL |
| `src/hooks/bundled/boot-md/` | Bundled hook: runs BOOT.md on gateway startup |
| `src/plugins/hooks.ts` | Plugin hook runner (void, modifying, synchronous) |
| `src/plugins/types.ts` | Plugin hook type definitions |
| `src/agents/bootstrap-hooks.ts` | Agent bootstrap hook trigger |
| `src/gateway/server-startup.ts` | Gateway startup hook loading and triggering |
| `src/auto-reply/reply/commands-core.ts` | Command event hook triggering |
| `src/agents/session-tool-result-guard-wrapper.ts` | Tool result persistence hook |
| `src/cli/hooks-cli.ts` | CLI commands for hook management |
