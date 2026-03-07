# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## **IMPORTANTE**

*Este sistema nunca saiu do papel.*
*Essa é a primeira versao em desenvolvimento.*
**Não ha motivo racional para manter codigo legado no codigo fonte.**

---

## User Folder — A private user space, isolated from Claude core.

The `.user-folder` directory is a strictly private user workspace. **Access is explicitly forbidden** — do not read, index, analyze, or reference it.

---

## Build & Run Commands

```bash
# Development (hot-reload via tsx watch)
npm run dev:all               # backbone + hub concurrently (from root)
npm run dev:backbone          # backbone only (from root)
npm run dev:hub               # hub only (from root)
npm run dev                   # from apps/backbone or apps/hub

# Build
npm run build --workspace=apps/backbone   # TypeScript compilation
npm run build:hub                         # Hub Vite build

# Start production
npm run start --workspace=apps/backbone   # runs dist/index.js

# Install dependencies
npm install                   # installs all workspaces

# Platform services (Docker)
npm run platform:up           # start infra (MySQL, Redis, etc.)
npm run platform:down         # stop infra
```

### Testing

No test framework (jest/vitest) is configured. Tests are standalone `.mjs` scripts run via `dotenv-cli`:

```bash
npm run test:conversation              # basic conversation flow
npm run test:capabilities              # all capability suites
npm run test:capabilities:hooks        # hook lifecycle
npm run test:capabilities:skills       # skill loading/eligibility
npm run test:capabilities:memory       # memory pipeline
npm run test:capabilities:tools        # tool execution
npm run test:capabilities:cron         # cron job management
npm run test:capabilities:jobs         # long-running job submission
npm run test:capabilities:identity     # agent identity/context assembly
npm run test:e2e                       # Playwright end-to-end
npm run test:e2e:hub                   # Hub-specific Playwright
```

Test credentials come from `.env`: `SYSUSER` / `SYSPASS`.

---

## Environment Variables

All environment variables are defined in the root `.env` file — the single source of truth.

**Validated at startup** (server throws if missing):
- `CONTEXT_FOLDER` — path to context directory, relative to monorepo root (e.g. `apps/backbone/context`)
- `JWT_SECRET` — JWT signing key
- `SYSUSER` / `SYSPASS` — system admin credentials
- `BACKBONE_PORT` — Backbone HTTP port (e.g. `7700`)

**API keys:**
- `OPENROUTER_API_KEY` (required) — OpenRouter API access
- `OPENAI_API_KEY` (optional) — enables memory embeddings via `text-embedding-3-small`

**Other:**
- `HUB_PORT` — Hub dev server port (e.g. `7701`)
- `EVOLUTION_URL` — if set, loads the Evolution (WhatsApp) module

**Port range convention:** `7700–7709` for project apps, `7710–7799` for Docker Compose services.

### No default values in source code

Never use fallback defaults for environment variables in code (e.g. `process.env.VAR ?? "value"`). A missing `.env` entry should fail loudly.

---

## Architecture

This is an **npm workspaces monorepo** with two apps and one internal package:

| Package | Path | Purpose |
|---|---|---|
| `@agentic-backbone/backbone` | `apps/backbone` | Autonomous multi-agent runtime (Node.js, Hono, Vercel AI SDK) |
| `@agentic-backbone/hub` | `apps/hub` | Admin UI / chat (React 19, TanStack Router, shadcn/ui, PWA) |
| `@agentic-backbone/ai-sdk` | `apps/packages/ai-sdk` | Agent runtime via Vercel AI SDK + OpenRouter |

### Core Flow

```
HTTP (Hono, :7700) → Routes → Conversations → Agent Runner → AI SDK (OpenRouter)
                         │                          ↓
                         │                    SSE streaming → client
                         │
                         ├── /system/events → SSE hub (event bus)
                         ├── /channels/:id/events → per-channel SSE
                         └── /users → user CRUD
```

### Agent Operating Modes

Agents exist and operate in three distinct modes:

| Mode | Trigger | Entry point | Description |
|---|---|---|---|
| **heartbeat** | Fixed-interval timer (default 30s) | `assembleHeartbeatPrompt()` | Autonomous — the agent is alive and independent. Active-hours gating, deduplication, skip-if-empty. |
| **conversation** | User message via chat | `assembleConversationPrompt()` | Reactive — the agent responds via chat within a session. |
| **cron** (agendado) | Cron schedule expression | `executeCronJob()` | Scheduled — the agent is woken by a cron job defined in `CRON.md` files. |

All three modes ultimately call `runAgent()`, which uses the AI SDK via OpenRouter.

### LLM Plan System

Uses Vercel AI SDK (`ai@^6`) via OpenRouter. Configured in `context/system/llm.json`.

**Plans** define per-role model profiles (`conversation`, `heartbeat`, `memory`). Multiple plans available: `economico`, `padrao`, `otimizado`, etc. The active plan is set in `context/system/llm.json` (editable at runtime via the `/settings` route). Plans are flat — `plans.economico`, `plans.padrao`, etc.

`resolveModel(role)` in `settings/llm.ts` is the single point of model selection.

### Startup Sequence

1. Creates Hono app, registers routes, JWT auth middleware
2. Scans `context/agents/*/AGENT.md` → agent registry
3. Scans `context/users/*/channels/*/CHANNEL.md` → channel registry
4. Starts connectors (Evolution if `EVOLUTION_URL` set, Twilio if voice channels exist)
5. Starts heartbeat scheduler (registers enabled agents)
6. Starts cron scheduler (registers agent cron jobs)
7. Initializes hooks, watchers (hot reload)
8. Listens on `BACKBONE_PORT`

### Source Modules (`apps/backbone/src/`)

| Module | Purpose |
|---|---|
| `index.ts` | Hono server entry; mounts routes, bootstraps subsystems |
| `routes/` | REST + SSE endpoints (health, conversations, channels, users, agents, cron, jobs, settings, system events) |
| `agent/` | `runAgent()` async generator — calls ai-sdk proxy with model/role/tools |
| `agents/` | Agent registry — discovers `AGENT.md` files, parses frontmatter config. Agent IDs use `owner.slug` dot notation |
| `conversations/` | Session lifecycle (create/get/sendMessage). SQLite for session index, filesystem for message history (JSONL) |
| `channels/` | Channel registry + system channel for heartbeat/system message delivery |
| `events/` | Typed `EventEmitter`-based event bus + SSE hub with per-channel subscriptions |
| `heartbeat/` | Autonomous tick scheduler. Per-agent: active-hours gating, deduplication, serialization guards, skip-if-empty |
| `cron/` | Cron scheduler (croner). Agents define jobs in `CRON.md` files; state persisted per-agent, run history in SQLite |
| `jobs/` | Long-running shell process supervisor. Tracks stdout/stderr, CPU/memory. Wake modes: `heartbeat` or `conversation` |
| `hooks/` | Lifecycle hooks (`startup`, `heartbeat:before/after`, `agent:before/after`, `message:received/sent`, `registry:changed`). Handlers are `.js` files next to `HOOK.md` |
| `memory/` | Semantic search: OpenAI embeddings → SQLite + sqlite-vec. Hybrid vector/FTS5. Periodic memory flush (every 20 messages) |
| `skills/` | Skill loading, runtime eligibility filtering (env vars, binaries, OS), prompt assembly |
| `tools/` | Tool loading from TOOL.md, prompt assembly |
| `connectors/` | Unified connector system — built-in TypeScript connectors (mysql, postgres, evolution, twilio) with client factories, tools, schemas, and optional routes/channel-adapters |
| `channel-adapters/` | Inbound channel adapter registry — SSE push, inbound message routing |
| `watchers/` | chokidar hot-reload: `AGENT.md` → refreshes registry + heartbeat; `CHANNEL.md` → refreshes channels; `ADAPTER.yaml` → emits event. 300ms debounce |
| `users/` | User CRUD — filesystem-based (USER.md with frontmatter), permission model |
| `context/` | Path resolution (`paths.ts`), resource resolver with precedence chain (`resolver.ts`), prompt assembly (`index.ts`), frontmatter parser |
| `settings/` | `llm.ts` — runtime LLM config read/write, model resolution |
| `db/` | Backbone SQLite database (sessions, heartbeat_log, cron_run_log tables). WAL mode |

### File-Based Context Repository (`apps/backbone/context/`)

Markdown-centric persistent state store with YAML frontmatter:

| Scope | Path | Contents |
|---|---|---|
| Shared (lowest precedence) | `shared/{skills,tools,adapters}/` | Available to all agents |
| System (mid precedence) | `system/{skills,tools,adapters}/` | System-scoped resources, `SOUL.md` (default), `llm.json` |
| Agent (highest precedence) | `agents/:owner.:slug/` | `AGENT.md`, `SOUL.md`, `HEARTBEAT.md`, `CONVERSATION.md`, `MEMORY.md`, `cron/`, conversations, skills, tools |
| Users | `users/:slug/USER.md` | User config + permissions |
| Channels | `users/:slug/channels/:slug/CHANNEL.md` | Channel definitions |

**Resource precedence:** shared → owner (system or user) → agent-specific. Resolved by `context/resolver.ts`.

**Templates** for new resources live in `context/.templates/`.

### Key Patterns

- **Async generator streaming** — `runAgent()`, `sendMessage()`, and the conversation layer all use `AsyncGenerator<AgentEvent>` consumed by Hono's `streamSSE()`.

- **Prompt assembly via XML sections** — `assembleAgentCore()` builds the shared agent identity with `<identity>`, `<agent_context>`, `<available_skills>`, `<available_tools>`, `<available_adapters>`, `<relevant_memories>` sections. Each operating mode extends the core: `assembleConversationPrompt()` adds `<conversation_instructions>`, `assembleHeartbeatPrompt()` adds `<heartbeat_instructions>`.

- **Heartbeat prompt pattern** — Responses matching `HEARTBEAT_OK` or ≤300 chars are treated as acknowledgments and skipped. Deduplication within 24h prevents repeated outputs.

- **Session persistence** — SQLite stores session index (`data/backbone.sqlite`). Per-session data lives on filesystem: `SESSION.md` (metadata) + `messages.jsonl` (history).

- **Memory pipeline** — Every 20 messages, a background agent extracts facts into `MEMORY.md`. All `.md` files in agent scope are chunked (400 tokens, 80 overlap), embedded, and indexed into per-agent SQLite databases (`agents/:id/.memory.sqlite`) with sqlite-vec for vector search + FTS5 for keyword search. Hybrid scoring: 0.7 vector + 0.3 text.

- **`enabled` flag (frontmatter)** — Agent/resource activation is controlled by `enabled: true|false` in YAML frontmatter. The heartbeat scheduler only registers agents where both `enabled` and `heartbeat-enabled` are `true`.

### Markdown Utilities (`context/index.ts`)

- **`isMarkdownEmpty(raw, opts?)`** — Checks if a `.md` file has meaningful content. Strips frontmatter by default (`ignoreFrontmatter: true`). Use this whenever the system needs to decide if a markdown document is "empty" (e.g. heartbeat skip-if-empty gate). Internally delegates to `isEffectivelyEmpty()` which ignores headers, bare bullets, and empty checkboxes.

### ai-sdk Package (`apps/packages/ai-sdk/`)

Alternative agent runtime using Vercel AI SDK against OpenRouter:

- `runAiAgent()` — async generator using `streamText()`, same `AgentEvent` output as claude provider
- Session persistence: saves/loads `CoreMessage[]` to `data/ai-sessions/`
- Context compaction: auto-compacts when context window threshold exceeded
- MCP support: stdio and http transports via `@ai-sdk/mcp`
- Tool repair: `createToolCallRepairHandler()` for malformed tool call JSON
- Built-in tools: `Read`, `Glob`, `Grep`, `Bash`, `Write`, `Edit`, `MultiEdit`, `ApplyPatch`, `AskUser`, `WebSearch`, `WebFetch`, `CodeSearch`, `Task`, `Batch`, `ListDir`

### Connector Pattern (`src/connectors/`)

Connectors are built-in TypeScript modules in `src/connectors/{slug}/`. Each connector:
- Exports a `ConnectorDef` with client factory, zod schemas, and optionally tools/routes/channel-adapter
- **One tool per file** — each tool lives in its own file inside `src/connectors/{slug}/tools/{tool-name}.ts`. This way, listing the files in a `tools/` folder immediately reveals all available tools for that connector. A `tools/index.ts` compositor imports all tool files and exports a single `create*Tools(slugs)` function.
- Adapters (instances) are YAML files in `context/{shared,system,agent}/adapters/{slug}/ADAPTER.yaml`
- ADAPTER.yaml contains: `connector`, `credential` (connection params), `options` (connector config), `policy` (readonly/readwrite)
- Supports env var interpolation: `${VAR}`

Available connectors: `mysql` (query/mutate tools), `postgres` (query/mutate tools), `evolution` (WhatsApp gateway with probe/state/routes/channel-adapter), `twilio` (voice calls with TwiML webhook routes/channel-adapter).

### SSE Event Types

The event bus emits these typed events consumed by the Hub: `connected`, `heartbeat:status`, `channel:message`, `registry:adapters`, `job:status`, `ping`.

### Auth

JWT-based. Internal backbone token generated at startup (1-year validity). Clients use `Authorization: Bearer <token>` header or `?token=` query param (needed for EventSource/SSE).

### Design Documents

`docs/openclaw-concepts/` contains reference designs for the heartbeat, memory, skills, and adapters subsystems. `docs/agentic-backbone/CONCEPT.md` and `docs/agentic-backbone/PLAN.md` cover system-level design.

### Specification

- First, we derive user stories from user prompts.
- Then, we extract requirements from those user stories and user prompts.
- Next, we formalize requirements into PRPs (Product Requirement Prompts).
- Finally, PRPs are implemented in the codebase as milestones.

**References**

- Learn more about specification document formats in `docs/what-is/SPECS.md`
- Learn more about the PRP format in `docs/what-is/PRP.md`

---

### Design UI/UX

**Sistema para brasileiros. Mantenha a interface em pt-BR**

**Rule of thumb guidelines:**

- Prefer shadcn components over custom HTML — they reduce source file size and provide standardized UX.
- Do not use colors or tailwind colors throughout the source code — use CSS tokens instead.

**Respeite a cultura do projeto. Antes de criar novas páginas e componentes estude como as páginas e componentes são feitas nesse projeto.**

### Routing (Hub)

**The URL is the single source of truth for UI state.** Everything the user perceives as a distinct place or view must be bookmarkable.

- **Navigation → routes.** Pages, tabs, detail panels, drawers — if it feels like a different screen, it gets its own path segment. Refreshing the page must restore the exact same view.
- **Query → query params.** Search terms, filters, sorting, pagination — anything that parametrizes a view goes in the query string, not in component state. The resulting URL must be shareable and produce the same results when opened by someone else.

**Never store navigational or query state solely in React state.** If a user presses F5 and loses context, a route is missing.

### Data Fetching (Hub)

**Polling (`refetchInterval`) is forbidden in the hub.** SSE is the single source of truth for real-time updates.

- Queries fetch data only on: component mount, SSE event response, and after mutations.
- Do not create new SSE channels without justification.
- The only exception is conditional polling during active QR code flows, where SSE does not guarantee sufficient timing.

### Hub State & Libraries

- **Zustand** — lightweight stores for UI state (`useUIStore` in `lib/store.ts`) and auth (`useAuthStore` in `lib/auth.ts`). Use for cross-component ephemeral state only.
- **TanStack React Query (v5)** — server state. API modules in `api/*.ts` export `queryOptions()` factories. Query keys follow the pattern `["resource"]` / `["resource", id]`.
- **SSE** — `useSSE` hook (`hooks/use-sse.ts`) subscribes to the event bus at layout level. Handles reconnection and typed events automatically.
- **API client** — `lib/api.ts` exports a `request<T>()` wrapper that injects JWT from `useAuthStore`. Base path: `/api/v1/ai`.
- **Chat streaming** — `lib/chat-stream.ts` implements SSE-based `streamMessage()` consuming `AgentEvent` JSON lines with abort signal support.

---

## TypeScript Configuration

- Target: ES2022, Module: ESNext, `"moduleResolution": "bundler"`
- Strict mode enabled
- ESM-only (`"type": "module"` in package.json) — use `.js` extensions in import paths
- Hub has path alias: `@/*` → `./src/*`

## Claude Code Skills & Commands

Project-specific Claude Code extensions live in `.claude/`:

### Skills (invoked via `/skill-name`)
- `/git-commit` — Conventional Commits (pt-BR, scoped). Use this for all commits.
- `/generate-prp` — Generate PRPs from user stories / feature ideas
- `/ui-ux` — Plan UI/UX for Hub pages/components before coding
- `/rocim` — Transform raw text into structured ROCIN/ROCI[TE]N prompts
- `/agent-browser`, `/e2e-test` — Browser automation and testing

### Commands (invoked via `/command-name`)
- `/vibe:create` — Create isolated worktree + scaffold for a PRP
- `/vibe:loop` — Incremental development loop in worktree
- `/vibe:merge-back` — Merge worktree changes back to parent
- `/derive:specs` — Derive specs from brainstorming session
- `/derive:prps` — Derive PRPs from specs

## OpenClaw Source Code

OpenClaw source code está em .tmp/openclaw
Se não estiver e precisar dele faça o cloning:

git clone https://github.com/openclaw/openclaw .tmp/openclaw
