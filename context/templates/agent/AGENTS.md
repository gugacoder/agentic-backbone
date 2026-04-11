# Agent

This agent is assembled from optional aspect files and one or more systems. This file describes the assembly and the execution protocols. Read the specific aspect and system files for details.

## Aspects

Aspect files in this directory describe facets of your behavior. If a file below exists, read it and follow its instructions. Absence means that aspect is not configured.

- `SOUL.md` — who you are
- `HEARTBEAT.md` — what you do on each recurring beat
- `REQUEST.md` — how you respond when invoked via API
- `CONVERSATION.md` — how you behave in chat

## Systems

Your capabilities are provided by self-contained systems under `.systems/`. Each system owns its own code, prompts, and state, and writes into shared locations under `kb/`.

### memory

You have a persistent knowledge base built from your own conversations. Its code lives at `.systems/memory/` and its data lives at `kb/`.

Key locations:

- `kb/HOME.md` — master index of everything you have learned
- `kb/calendar/notes/` — daily conversation logs (raw source)
- `kb/atlas/concepts/`, `kb/atlas/connections/` — compiled atomic knowledge
- `kb/atlas/maps/` — higher-order notes (MOCs, Hubs), including `atlas/maps/memory.md` (hub for the memory system)
- `kb/atlas/qa/` — finalized question-answer pairs
- `kb/atlas/works/` — delivered productions (Communicate layer)
- `kb/effort/` — work in progress, organized as `on/`, `simmering/`, `off/`
- `kb/calendar/events/` — future-facing notes
- `KNOWLEDGE_BASE.md` (workspace root) — structural contract for `kb/` that any agent writing to the base must follow
- `.systems/memory/SYSTEM.md` — operational specification for the memory system

When answering questions that may draw on past knowledge, consult `kb/HOME.md` first to see what is already known, then read the articles listed there before responding.

## Execution protocol

- Claude Code hooks configured in `.claude/settings.json` invoke system scripts on session events (start, end, pre-compact).
- Hooks from any system under `.systems/` are routed through `uv run --directory .systems`, which uses the shared Python environment defined by `.systems/pyproject.toml` and `.systems/uv.lock`.
- Slash commands under `.claude/commands/` expose interactive operations for each system.
- Each system is responsible for creating its own subdirectories under `kb/` on first write. System-scoped binary state lives at `kb/x/<slug>/`, and day-scoped artifacts (operational logs, captured contexts) live at `kb/calendar/system/YYYY-MM-DD/` with filenames prefixed by the system slug (e.g. `log-memory.md`, `session-flush-memory-*.md`) so multiple systems can share the same per-day folder.
