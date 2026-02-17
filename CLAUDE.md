# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## User Folder — A private user space, isolated from Claude core.

⚠️ **System Boundary Notice**

The `.user-folder` directory is a strictly private user workspace.
It contains personal notes and draft material that must not influence system reasoning or project interpretation.

**Access to this directory is explicitly forbidden.**

* Do not read
* Do not index
* Do not analyze
* Do not reference

**Violation of this boundary may compromise agent neutrality.**

---

## Build & Run Commands

```bash
# Development (hot-reload via tsx watch)
npm run dev:backbone          # from root
npm run dev                   # from apps/backbone

# Build
npm run build --workspace=apps/backbone   # TypeScript compilation

# Start production
npm run start --workspace=apps/backbone   # runs dist/index.js

# Install dependencies
npm install                   # installs all workspaces
```

No test framework or linter is configured yet.

---

## Usuário e Senha para Testes

Para testes de cesso ao sistema via playwright, curl, etc, utilize as credenciais de acesso disponíveis no .env:
- SYSUSER
- SYSPASS

---

## Environment Variables

All environment variables are defined in the root `.env` file — the single source of truth.

- `ANTHROPIC_API_KEY` (required) — Claude API access
- `OPENAI_API_KEY` (optional) — Enables memory embeddings via `text-embedding-3-small`
- `BACKBONE_PORT` — Backbone HTTP server port (e.g. `7700`)
- `HUB_PORT` — Hub dev server port (e.g. `7701`)

**Port range convention:** `7700–7709` for project apps, `7710–7799` for Docker Compose services.

### No default values in source code

Never use fallback defaults for environment variables in code (e.g. `process.env.VAR ?? "value"`). Spreading defaults across source files misleads deployers into thinking the system is properly configured when it isn't — a missing `.env` entry should fail loudly, not silently fall back to a hardcoded value that may be wrong for the target environment.

## Architecture

This is an **npm workspaces monorepo** with one app (`apps/backbone`) — an autonomous multi-agent runtime built on Node.js, Hono, and the Claude Agent SDK.

### Core Flow

```
HTTP (Hono, :7700) → Routes → Conversations → Agent Runner (Claude Agent SDK)
                         │                          ↓
                         │                    SSE streaming → client
                         │
                         ├── /system/events → SSE hub (event bus)
                         ├── /channels/:id/events → per-channel SSE
                         └── /users → user CRUD
```

### Startup Sequence

1. Creates Hono app, registers routes
2. Scans `context/agents/*/AGENT.md` → agent registry
3. Scans `context/users/*/channels/*/CHANNEL.md` → channel registry
4. Creates heartbeat scheduler, registers enabled agents
5. Listens on port 7700

### Source Modules (`apps/backbone/src/`)

| Module | Purpose |
|---|---|
| `index.ts` | Hono server entry; mounts routes, bootstraps heartbeat |
| `routes/` | REST + SSE endpoints (health, conversations, channels, users, system events) |
| `agent/` | Wraps `@anthropic-ai/claude-agent-sdk` `query()` as async generator. Tool allowlist: `Read, Glob, Grep, Bash, Write, Edit` |
| `agents/` | Agent registry — discovers `AGENT.md` files, parses frontmatter config. Agent IDs use `owner.slug` dot notation |
| `conversations/` | Session lifecycle (create/get/sendMessage). SQLite for session index, filesystem for message history (JSONL) |
| `channels/` | Channel registry + system channel for heartbeat/system message delivery |
| `events/` | Typed `EventEmitter`-based event bus (`heartbeat:status`, `channel:message`) + SSE hub with per-channel subscriptions |
| `heartbeat/` | Autonomous 30s tick scheduler. Per-agent: active-hours gating, deduplication, serialization guards, skip-if-empty |
| `memory/` | Semantic search: OpenAI embeddings → SQLite + sqlite-vec. Hybrid vector/FTS5 search. Periodic memory flush (every 20 messages) |
| `skills/` | Skill loading, runtime eligibility filtering (env vars, binaries, OS), prompt assembly |
| `tools/` | Tool loading from TOOL.md, prompt assembly |
| `adapters/` | Outbound adapter registry with factory pattern. Ships with `ConsoleAdapter` |
| `users/` | User CRUD — filesystem-based (USER.md with frontmatter), permission model |
| `context/` | Path resolution (`paths.ts`), resource resolver with precedence chain (`resolver.ts`), prompt assembly (`index.ts`), frontmatter parser |
| `db/` | Backbone SQLite database (sessions table). WAL mode, foreign keys enabled |

### File-Based Context Repository (`apps/backbone/context/`)

Markdown-centric persistent state store with YAML frontmatter:

| Scope | Path | Contents |
|---|---|---|
| Shared (lowest precedence) | `shared/{skills,tools,adapters}/` | Available to all agents |
| System/User (mid precedence) | `system/{skills,tools,adapters}/` or `users/:slug/` | Owner-scoped resources |
| Agent (highest precedence) | `agents/:owner.:slug/` | `AGENT.md`, `SOUL.md`, `HEARTBEAT.md`, `CONVERSATION.md`, `MEMORY.md`, conversations, skills, tools |
| Users | `users/:slug/USER.md` | User config + permissions |
| Channels | `users/:slug/channels/:slug/CHANNEL.md` | Channel definitions |

**Resource precedence:** shared → owner (system or user) → agent-specific. Resolved by `context/resolver.ts`.

### Key Patterns

- **Async generator streaming** — `runAgent()`, `sendMessage()`, and the conversation layer all use `AsyncGenerator<AgentEvent>` consumed by Hono's `streamSSE()`.

- **Prompt assembly via XML sections** — `assembleAgentCore()` builds the shared agent identity with `<identity>`, `<agent_context>`, `<available_skills>`, `<available_tools>`, `<available_adapters>`, `<relevant_memories>` sections. `assembleConversationPrompt()` extends it with `<conversation_instructions>`. `assembleHeartbeatPrompt()` extends it with `<heartbeat_instructions>`. Skills/tools are listed by name; the agent reads the full `.md` file on-demand.

- **Heartbeat prompt pattern** — `assembleHeartbeatPrompt()` (async) expects agent responses matching `HEARTBEAT_OK`. Responses ≤300 chars are treated as acknowledgments and skipped. Deduplication within 24h prevents repeated outputs.

- **Session persistence** — SQLite stores session index (`data/backbone.sqlite`). Per-session conversation data lives on filesystem: `SESSION.md` (metadata) + `messages.jsonl` (history).

- **Memory pipeline** — Every 20 messages, a background agent extracts facts into `MEMORY.md`. All `.md` files in agent scope are chunked (400 tokens, 80 overlap), embedded, and indexed into per-agent SQLite databases (`agents/:id/.memory.sqlite`) with sqlite-vec for vector search + FTS5 for keyword search. Hybrid scoring: 0.7 vector + 0.3 text.

### Markdown Utilities (`context/index.ts`)

- **`isMarkdownEmpty(raw, opts?)`** — Checks if a `.md` file has meaningful content. Strips frontmatter by default (`ignoreFrontmatter: true`). Use this whenever the system needs to decide if a markdown document is "empty" (e.g. heartbeat skip-if-empty gate). Internally delegates to `isEffectivelyEmpty()` which ignores headers, bare bullets, and empty checkboxes.

- **`enabled` flag (frontmatter)** — Agent/resource activation is controlled by `enabled: true|false` in YAML frontmatter. Parsed by `parseFrontmatter()` in `context/frontmatter.ts` and checked as `metadata.enabled === true` in `agents/registry.ts:29`. The heartbeat scheduler only registers agents where both `enabled` and `heartbeat-enabled` are `true` (`heartbeat/index.ts:220`).

### Design Documents

`docs/openclaw-concepts/` contains reference designs for the heartbeat, memory, skills, and adapters subsystems. `docs/CONCEPT.md` and `docs/PLAN.md` cover system-level design.

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

**Use these references for building better UI/UX:**

- refs\ux\colorization.md — Pattern de tokens CSS semânticos
- refs\ux\react — React Patterns
- refs\ux\shadcn-v4 — shadcn component references
- refs\ux\framer-motion.md — Motion pattern for modern apps
- refs\ux\mobile-patterns.md — Patterns for mobile improved user experience
- refs\ux\vaul.md — Decision patterns for building drawers and popups consistently
- refs\pwa\PWA-Mobile-First-Agentic-App.md — Patterns for build PWA mobile-first apps

**Rule of thumb guidelines:**

- It's strongly recomended to user shadcn components instead of customizing components throught tweaking html.
- Shadcn components reduzies the sizes of source files while also provides better standardized user experience.
- Do not use colors throughout the source code — use CSS tokens instead.
- Do not use tailwind colors throughout the source code — use CSS tokens instead.

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

---

## TypeScript Configuration

- Target: ES2022, Module: ESNext, `"moduleResolution": "bundler"`
- Strict mode enabled
- ESM-only (`"type": "module"` in package.json) — use `.js` extensions in import paths

## Notes

**Use Prompt Caching @"docs\claude-code\Prompt Caching — Guia Rápido.md"**
