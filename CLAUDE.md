# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Build & Run Commands

```bash
# Development (hot-reload via tsx watch)
npm run dev:all               # backbone + hub + chat concurrently (from root)
npm run dev:backbone          # backbone only (from root)
npm run dev:hub               # hub only (from root)
npm run dev:chat              # chat only (from root)

# Build (sequential: gitlab → backbone → hub → web)
npm run build                 # all packages
npm run build:packages        # gitlab only

# Start production
npm run setup                 # gera JWT_SECRET e ENCRYPTION_KEY seguros (obrigatorio em production/staging)
npm run start --workspace=apps/backbone

# Install dependencies
npm install                   # installs all workspaces

# Platform services (Docker)
npm run platform:up           # start infra (MySQL, Redis, etc.)
npm run platform:down         # stop infra
```

### Testing

No test framework configured. Tests are standalone `.mjs` scripts:

```bash
npm run test:conversation              # basic conversation flow
npm run test:capabilities              # all capability suites
npm run test:capabilities:hooks        # hook lifecycle
npm run test:capabilities:skills       # skill loading/eligibility
npm run test:capabilities:memory       # memory pipeline
npm run test:capabilities:cron         # cron job management
npm run test:capabilities:jobs         # long-running job submission
npm run test:capabilities:identity     # agent identity/context assembly
npm run test:e2e                       # Playwright end-to-end
npm run test:e2e:hub                   # Playwright hub project only
```

### Utility Scripts

```bash
npm run secrets:decrypt                # decrypt YAML secrets
npm run secrets:encrypt                # encrypt YAML secrets
npm run killports                      # kill processes on dev ports
npm run ngrok:up                       # expose backbone via ngrok
```

Test credentials come from `.env`: `TEST_USER` / `TEST_PASS`.

**IMPORTANT**: Always use `npm run` commands, never run apps directly (tsx, node, etc). The npm scripts use `dotenv-cli` to properly expand env vars like `${PREFIX}`. Hub proxy to backbone (`/api` → `:BACKBONE_PORT`) is already configured in `vite.config.ts` and only works when started via `npm run dev:all`.

---

## Environment Variables

All env vars are in the root `.env` file — single source of truth. **Never use fallback defaults in code** (`process.env.VAR ?? "value"`). Missing vars must fail loudly.

**Required at startup:**
- `CONTEXT_FOLDER` — path to context directory, relative to monorepo root (e.g. `context`)
- `JWT_SECRET` — JWT signing key
- `BACKBONE_PORT` — HTTP port (currently `6002`)

**API keys:**
- `OPENROUTER_API_KEY` (required) — OpenRouter API access
- `OPENAI_API_KEY` (optional) — memory embeddings via `text-embedding-3-small`

**Optional:**
- `EVOLUTION_URL` — if set, loads the Evolution (WhatsApp) connector

---

## Architecture

**npm workspaces monorepo** with two packages:

| Package | Path | Purpose |
|---|---|---|
| `@agentic-backbone/backbone` | `apps/backbone` | Autonomous multi-agent runtime (Node.js, Hono, Vercel AI SDK) |
| `@agentic-backbone/hub` | `apps/hub` | React admin UI (Vite + TanStack Router) |
| `@agentic-backbone/chat` | `apps/chat` | Standalone chat UI |
| `@codrstudio/agentic-sdk` | **external** ([codrstudio/agentic-sdk](https://github.com/codrstudio/agentic-sdk)) | Agent runtime via Vercel AI SDK + OpenRouter |
| `@codrstudio/agentic-chat` | **external** ([codrstudio/agentic-chat](https://github.com/codrstudio/agentic-chat)) | Shared chat UI components |
| `@agentic-backbone/ui` | `packages/ui` | Shared UI component library (shadcn) |

### Core Flow

```
HTTP (Hono, :6002) → Routes (/api/v1/ai) → Conversations → Agent Runner → AI SDK (OpenRouter)
                          │                                      ↓
                          │                                SSE streaming → client
                          │
                          ├── /system/events → SSE hub (event bus)
                          ├── /channels/:id/events → per-channel SSE
                          └── /users → user CRUD
```

### Agent Operating Modes

| Mode | Trigger | Description |
|---|---|---|
| **conversation** | User message via chat | Reactive — responds within a session |
| **heartbeat** | Fixed-interval timer (default 30s) | Autonomous — active-hours gating, dedup, skip-if-empty |
| **cron** | Cron schedule expression | Scheduled — defined in agent `cron/*.yml` files |

All three modes call `runAgent()` via the AI SDK through OpenRouter.

### Source Modules (`apps/backbone/src/`)

| Module | Purpose |
|---|---|
| `index.ts` | Hono server entry; mounts routes, bootstraps subsystems |
| `routes/` | REST + SSE endpoints (health, conversations, channels, users, agents, cron, jobs, settings, services, system events) |
| `agent/` | `runAgent()` async generator — calls ai-sdk with model/role/tools |
| `agents/` | Agent registry — discovers `AGENT.yml` files, parses YAML config. Agent IDs = `owner.slug` |
| `conversations/` | Session lifecycle. SQLite for session index, filesystem for message history (JSONL) |
| `channels/` | Channel registry + delivery subsystem (SSE, connector adapters) |
| `events/` | Typed `EventEmitter`-based event bus + SSE hub with per-channel subscriptions |
| `heartbeat/` | Autonomous tick scheduler. Per-agent: active-hours gating, dedup, serialization |
| `cron/` | Cron scheduler (croner). Jobs defined in `cron/*.yml` files; state in SQLite |
| `jobs/` | Long-running shell process supervisor. Tracks stdout/stderr, CPU/memory |
| `hooks/` | Lifecycle hooks (`startup`, `heartbeat:before/after`, `agent:before/after`, etc.) |
| `memory/` | Semantic search: OpenAI embeddings → SQLite + sqlite-vec. Hybrid vector/FTS5 |
| `skills/` | Skill loading, runtime eligibility filtering, prompt assembly |
| `services/` | Service loading, execution, CRUD. Services are user-defined automations |
| `connectors/` | Built-in TypeScript connectors (mysql, postgres, evolution, twilio) with client factories, tools, schemas |
| `watchers/` | chokidar hot-reload for `AGENT.yml`, `CHANNEL.yml`, `ADAPTER.yml`. 300ms debounce. Auto-encrypts `.yml` sensitive fields |
| `users/` | User CRUD — `USER.md` (profile) + `credential.yml` (secrets, auto-encrypted) |
| `context/` | Path resolution (`paths.ts`), resource resolver (`resolver.ts`), readers (`readers.ts` — readMarkdown/readYaml), encryptor (`encryptor.ts`) |
| `settings/` | `llm.ts` — runtime LLM config read/write, model resolution |
| `db/` | Backbone SQLite database (sessions, heartbeat_log, cron_run_log). WAL mode |
| `utils/` | Shared utilities — `sensitive.ts` (field masking), `encryption.ts` (AES-256-GCM for `.yml` secrets) |

### File-Based Context Repository (`context/`)

Structure and file types defined in `context/.skeleton.md` (single source of truth).

**Resource precedence:** shared → owner (system or user) → agent-specific. Resolved by `context/resolver.ts`.

### Key Patterns

- **Async generator streaming** — `runAgent()`, `sendMessage()`, and the conversation layer use `AsyncGenerator<AgentEvent>` consumed by Hono's `streamSSE()`.

- **Prompt assembly via XML sections** — `assembleAgentCore()` builds shared agent identity with `<identity>`, `<agent_context>`, `<available_skills>`, `<available_tools>`, etc. Each mode extends the core with mode-specific sections.

- **Heartbeat prompt pattern** — Responses matching `HEARTBEAT_OK` or ≤300 chars are treated as acknowledgments and skipped. Deduplication within 24h.

- **Session persistence** — SQLite stores session index (`data/backbone.sqlite`). Per-session: `SESSION.yml` (metadata) + `messages.jsonl` (history).

- **Memory pipeline** — Every 20 messages, a background agent extracts facts into `MEMORY.md`. All `.md` files in agent scope are chunked (400 tokens, 80 overlap), embedded, and indexed into per-agent SQLite databases with sqlite-vec + FTS5. Hybrid scoring: 0.7 vector + 0.3 text.

- **`enabled` flag** — Agent/resource activation controlled by `enabled: true|false` in YAML config. Heartbeat requires both `enabled` and `heartbeat-enabled` to be `true`.

- **Two file types** — `.md` files are prompts (with optional frontmatter for hybrids like SKILL.md, SERVICE.md). `.yml` files are pure metadata (AGENT.yml, CHANNEL.yml, ADAPTER.yml, SESSION.yml, credential.yml, cron/*.yml). Use `readMarkdown()`/`writeMarkdown()` for .md, `readYaml()`/`writeYaml()` for .yml. Both are in `context/readers.ts`.

- **Auto-encryption** — `.yml` files with sensitive fields (matching `key|secret|token|password|pass`) are auto-encrypted on startup and on file change. Values stored as `ENC(base64...)`, decrypted transparently by `readYaml()`. Key derived from `JWT_SECRET` via scrypt.

- **Sensitive field masking** — `utils/sensitive.ts` masks secrets in API responses. Use `maskSensitiveFields()` instead of inline masking.

### agentic-sdk (external: `@codrstudio/agentic-sdk`)

- **Repo:** https://github.com/codrstudio/agentic-sdk
- Installed via git dependency: `"@codrstudio/agentic-sdk": "github:codrstudio/agentic-sdk#v0.1.0"`
- `runAiAgent()` — async generator using `streamText()`, same `AgentEvent` output
- Context compaction: auto-compacts when context window threshold exceeded
- MCP support: stdio and http transports
- Built-in tools: `Read`, `Glob`, `Grep`, `Bash`, `Write`, `Edit`, `MultiEdit`, `ApplyPatch`, `AskUser`, `WebSearch`, `WebFetch`, `CodeSearch`, `Task`, `Batch`, `ListDir`

### Connector Pattern (`src/connectors/`)

Each connector in `src/connectors/{slug}/`:
- Exports a `ConnectorDef` with client factory, zod schemas, optionally tools/routes/channel-adapter
- **One tool per file** in `src/connectors/{slug}/tools/{tool-name}.ts`
- Adapters (instances) are YAML files in `context/{shared,system,agent}/adapters/{slug}/ADAPTER.yml`
- `ADAPTER.yml` contains: `connector`, `credential`, `options`, `policy` (readonly/readwrite)
- Sensitive fields in `.yml` (keys matching `key|secret|token|password|pass`) are auto-encrypted via AES-256-GCM
- Supports env var interpolation: `${VAR}`

Available connectors: `discord`, `elevenlabs`, `email`, `evolution` (WhatsApp), `github`, `gitlab`, `http`, `implantacao`, `mcp`, `mysql`, `postgres`, `slack`, `teams`, `twilio` (voice), `whatsapp-cloud`.

### Auth

JWT-based. Hybrid: accepts both Laravel JWT (`role_id` + `unidades`) and Backbone JWT (`role`). Clients use `Authorization: Bearer <token>` or `?token=` query param (for EventSource/SSE). Paths containing `/webhook` bypass auth.

**Emitir JWT para testes (via API):**
```bash
# Login — POST /api/v1/ai/auth/login
curl -s -X POST http://localhost:6002/api/v1/ai/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"system","password":"12345678"}'
# → {"token":"eyJ..."}

# Usar o token
curl -s http://localhost:6002/api/v1/ai/agents \
  -H "Authorization: Bearer <token>"
```
Usuário de teste: `system` (user em `context/users/system/`), senha `12345678`.

---

## TypeScript Configuration

- Target: ES2022, Module: ESNext, `"moduleResolution": "bundler"`
- Strict mode enabled
- ESM-only (`"type": "module"`) — use `.js` extensions in import paths
- `dotenv-cli` required for env loading (`node --env-file` does NOT interpolate `${VAR}`)

## Project Hygiene

- **Temporary files go in `.tmp/`** — scripts, test outputs, browser sessions, etc. Never clutter the root. Add `.tmp/` to `.gitignore`.
- **Test assets in `assets/`** — e.g. `assets/elevenlabs-test.mp3` (áudio de teste ElevenLabs gerado via `.tmp/gen-test-audio.mjs`).
- **YAML files must never be written with raw `fs`** — always use `writeYamlAs` (create) or `patchYamlAs` (update) from `context/readers.ts`. See `guides/yaml-metadata/GUIDE.md`.

## Agent Design Rules

- `composeAgentTools()` must give ALL tools in ALL modes. No `if (mode === "x")` guards.
- Features added to the agent must work in conversation, heartbeat, cron — equally.
- Never add mode-specific code paths unless there's a hard technical reason.

## Password Policy

Política definida em `users/password.ts` (`validatePasswordPolicy`): mínimo 12 chars, pelo menos uma letra e um dígito. Usar sempre que houver criação ou troca de senha.

## Specification Workflow

- User stories → requirements → PRPs (Product Requirement Prompts) → implementation milestones
- PRP reference: `sprints/milestones/`

## UI Design Rules

- **Sistema para brasileiros. Interface em pt-BR.**
- Prefer shadcn components over custom HTML
- Use CSS tokens, not Tailwind color classes directly

## Claude Code Skills & Commands

### Skills (invoked via `/skill-name`)
- `/git-commit` — Conventional Commits (pt-BR, scoped). Use this for all commits.
- `/generate-prp` — Generate PRPs from user stories / feature ideas
- `/ui-ux` — Plan UI/UX for pages/components before coding
- `/rocim` — Transform raw text into structured ROCIN/ROCI[TE]N prompts

## HotReload

O comando `npm run dev:all`:
- **Lança os serviços com hot-reload**
- **Mantém um log em .tmp\-run.log**
