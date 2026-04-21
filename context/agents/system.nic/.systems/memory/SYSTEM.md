# Memory System — Operational Specification

> Inspired by [Andrej Karpathy's LLM Knowledge Base](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) architecture.
> Organized loosely around [LYT](https://www.linkingyourthinking.com/) by Nick Milo — ACE folders (Atlas / Calendar / Effort) and atomic notes.
> The memory system compiles knowledge from the agent's own conversations into a navigable knowledge base.

## Roots

The memory system distinguishes two roots:

- **`SYSTEM_DIR`** = `.systems/memory/` — code, prompts, and this specification. Self-contained module. Nothing under this root is written at runtime beyond ephemeral state.
- **`AGENT_ROOT`** = workspace root (one level above `.systems/`) — the agent's workspace. The memory system writes into `kb/` here.

All paths below are anchored at `AGENT_ROOT` unless marked otherwise.

## The compiler analogy

```
kb/calendar/notes/  = source code    (conversations — the raw material)
LLM                 = compiler       (extracts and organizes knowledge)
kb/atlas/ + effort/ = executable     (structured, queryable knowledge base)
lint                = test suite     (health checks for consistency)
queries             = runtime        (using the knowledge)
```

The agent does not manually organize its knowledge. It has conversations; the memory system handles synthesis, cross-referencing, and maintenance.

## Directory layout under `kb/`

```
kb/
├── HOME.md                                             # Master index (the retrieval mechanism)
├── +/                                                  # Inbox — external files awaiting ingestion
├── atlas/                                              # Reference knowledge (permanent)
│   ├── concepts/                                       #   Atomic knowledge articles
│   ├── connections/                                    #   Cross-cutting insights linking 2+ concepts
│   ├── maps/                                           #   Higher-order notes (MOCs, Hubs)
│   │   └── memory.md                                   #     Hub note for this system
│   ├── qa/                                             #   Finalized query answers
│   └── works/                                          #   Delivered productions (Communicate)
├── calendar/                                           # Time-stamped entries
│   ├── notes/                                          #   Daily conversation logs (immutable source)
│   │   └── YYYY-MM-DD.md
│   ├── events/                                         #   Future-facing notes, grouped per day
│   │   └── YYYY-MM-DD/
│   │       └── <slug>.md
│   └── system/                                         #   System-generated operational records
│       ├── log.md                                      #     Global build log (compile/ingest/query/lint)
│       └── YYYY-MM-DD/                                 #     Per-day folders shared across systems
│           ├── log-memory.md                           #       Operational log for the memory system
│           ├── lint.md                                 #       Lint report for that day
│           └── session-flush-memory-<session>-<ts>.md  #       Captured session contexts
├── effort/                                             # Active work in progress
│   ├── on/                                             #   Active projects
│   ├── simmering/                                      #   Paused projects (may resume)
│   └── off/                                            #   Abandoned projects (kept as record)
└── x/                                                  # Non-markdown artifacts
    ├── files/                                          #   Preserved binaries ingested from the inbox
    └── memory/                                         #   Memory system's private state
        ├── state.json                                  #     Compile + ingest state (hashes, cost)
        └── last-flush.json                             #     Dedup state (last session flushed)
```

### Per-day system folder

Everything a system writes for a given day lives together under `kb/calendar/system/YYYY-MM-DD/`. Filenames carry the system slug (e.g. `log-memory.md`, `session-flush-memory-*.md`), so multiple systems can share the same day folder without nested subdirectories. When a second system is added, its files (`log-planning.md`, `session-flush-planning-*.md`) coexist in the same per-day folder — no path restructuring required.

## Layer 1 — `kb/calendar/notes/` (immutable source)

Daily logs capture what happened in the agent's sessions. Append-only, never edited after the fact. Each file is one day's conversation record:

```markdown
# Daily Log: YYYY-MM-DD

## Sessions

### Session (HH:MM) - Brief Title

**Context:** What the user was asking about, thinking about, or doing.

**Key Exchanges:**
- Meaningful Q&A or discussions

**Decisions Made:**
- Commitments with reasoning

**Lessons Learned:**
- Facts, insights, misconceptions corrected

**Action Items:**
- Follow-ups
```

These files are written by `flush.py` at the end of each session (via `session-end.py` hook) and by the `/kb:note` slash command.

## Layer 2 — `kb/atlas/` + `kb/effort/` (compiled knowledge)

The LLM owns these directories. The article formats, frontmatter rules, conventions, and quality standards are defined in `.systems/memory/prompts/schema.md` — that file is injected into the compile prompt at runtime. See `prompts/schema.md` for the current specification.

## Layer 3 — `kb/HOME.md` (master catalog)

The root Map of Content: a single table listing every knowledge article. This is the primary retrieval mechanism. The LLM reads HOME.md first when answering any query, then selects relevant articles to read in full.

Format:

```markdown
# Knowledge Base Index

| Article | Summary | Compiled From | Updated |
|---------|---------|---------------|---------|
| [[concepts/example]] | One-line summary | calendar/notes/YYYY-MM-DD.md | YYYY-MM-DD |
```

## Core operations

### 1. Capture (hook → flush.py)

1. Claude Code fires `SessionEnd` or `PreCompact`.
2. The hook reads the transcript, extracts text turns, writes the raw context to `kb/calendar/system/YYYY-MM-DD/session-flush-memory-<session_id>-<timestamp>.md`.
3. The hook spawns `flush.py` as a detached background process, passing the context file path.
4. `flush.py` loads `prompts/flush.md`, sends the context to the Claude Agent SDK, and appends the structured result to `kb/calendar/notes/YYYY-MM-DD.md`.
5. `flush.py` updates `kb/x/memory/last-flush.json` for the 60-second dedup window.
6. If the current time is past `COMPILE_AFTER_HOUR` (default 18:00 local) and today's daily log has changed since last compile, `flush.py` triggers `compile.py` as another detached process.

### 2. Compile (daily log → articles)

1. `compile.py` iterates over daily logs that are new or whose hash has changed since the last compile.
2. For each log, it loads `prompts/compile.md`, injects `prompts/schema.md` as the schema, current `HOME.md` as the index, and all existing articles as context.
3. The LLM extracts 3–7 concepts, creates or updates articles in `atlas/concepts/` and `atlas/connections/`, updates `HOME.md`, and appends to `calendar/system/log.md`.
4. `state.json` is updated with the log's hash, compile timestamp, and API cost.

### 3. Query (question → synthesized answer)

1. `query.py` loads `prompts/query.md` with HOME.md and all articles inlined.
2. The LLM reads the index, selects 3–10 relevant articles, reads them in full, and synthesizes an answer with `[[wikilink]]` citations.
3. If `--file-back` is set, the LLM also creates a Q&A article in `atlas/qa/`, updates HOME.md, and appends to `calendar/system/log.md`.

### 4. Ingest (external file → articles)

The inbox `kb/+/` is where the agent (or its owner) drops external files that should be absorbed into the knowledge base — PDFs, images, audio, markdown drafts, source code, whatever. `scripts/kb/ingest.py` walks the inbox and delegates each file to the Claude Agent SDK, with a broad toolset and `permission_mode="bypassPermissions"`:

1. `ingest.py` lists files in `kb/+/` and skips any whose content hash is already recorded in `state.json["ingested_files"]`.
2. For each new file, it loads `prompts/ingest.md`, injects `prompts/schema.md`, the current `HOME.md`, and all existing articles as context, and calls the Agent SDK with tools `Read`, `Write`, `Edit`, `Glob`, `Grep`, `Bash`.
3. The agent decides how to extract the file's content based on type: `Read` for text and images, `Bash` with `pdftotext` or `pymupdf` for PDFs, `Bash` with `whisper` or `ffmpeg` for audio/video, etc. If the required tool is missing, the agent creates a stub note and preserves the binary.
4. The agent files the content into the wiki as a new concept, an update to an existing concept, or a connection article — following the same schema as compile.
5. If the file has inherent form worth preserving (binary, complex source, etc.), the agent moves it from `kb/+/` to `kb/x/files/` and wikilinks it in the `Sources` section of the article. Otherwise the file is consumed and deleted.
6. The agent updates `HOME.md` and appends an `ingest` entry to `calendar/system/log.md`.
7. `state.json["ingested_files"]` is updated with the file's hash, timestamp, and cost.

Because ingestion is agent-driven rather than handler-driven, adding support for a new file type is a matter of installing a new tool (a new binary on `PATH`, a new Python library, an MCP server) — no code change is required.

### 5. Lint (health checks)

Seven checks run by `lint.py`:

| Check | Type | Catches |
|-------|------|---------|
| Broken links | Structural | `[[wikilinks]]` to non-existent articles |
| Orphan pages | Structural | Articles with zero inbound links |
| Orphan sources | Structural | Daily logs not yet compiled |
| Stale articles | Structural | Source logs changed since compilation |
| Missing backlinks | Structural | A links to B but B doesn't link back |
| Sparse articles | Structural | Under 200 words |
| Contradictions | LLM | Conflicting claims across articles |

Reports are saved to `kb/calendar/system/YYYY-MM-DD/lint.md`.

## Hook pipeline

Hooks are configured in `.claude/settings.json` and fire automatically when Claude Code runs in this workspace. Each hook command is:

```
uv run --directory .systems python .systems/memory/scripts/hooks/<name>.py
```

The `--directory .systems` flag points `uv` at the shared `pyproject.toml` at `.systems/pyproject.toml`.

### `session-start.py` (SessionStart)

- Pure local I/O, no API calls, runs in under 1 second.
- Reads `kb/HOME.md` and the most recent daily log.
- Outputs JSON to stdout: `{"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": "..."}}`.
- Max context: 20,000 characters.

### `session-end.py` (SessionEnd)

- Reads hook input from stdin (JSON with `session_id`, `transcript_path`).
- Extracts text turns from the JSONL transcript, filters harness noise (`<local-command-*>`, `<command-name>`, etc.), drops tool calls and tool results.
- Writes the extracted context directly to `kb/calendar/system/YYYY-MM-DD/session-flush-memory-<session_id>-<timestamp>.md`.
- Spawns `flush.py` as a detached background process pointing at that context file.
- Recursion guard: exits immediately if `CLAUDE_INVOKED_BY` env var is set.

### `pre-compact.py` (PreCompact)

- Same architecture as `session-end.py`.
- Fires before Claude Code auto-compacts the context window.
- Guards against empty `transcript_path` (known Claude Code bug #13668).
- Critical for long sessions: captures context before summarization discards it.

**Why both PreCompact and SessionEnd?** Long-running sessions may trigger multiple auto-compactions before they close. Without PreCompact, intermediate context is lost to summarization before SessionEnd ever fires.

## Background flush process (`scripts/kb/flush.py`)

Spawned by both hooks as a detached background process:

- **Windows:** no `DETACHED_PROCESS` flag (breaks the Agent SDK's subprocess I/O); uses `CREATE_NO_WINDOW` to avoid console flash.
- **Mac/Linux:** `start_new_session=True`.

`flush.py` survives after Claude Code's hook process exits.

What it does:

1. Sets `CLAUDE_INVOKED_BY=memory_flush` env var (prevents recursive hook firing).
2. Reads the pre-extracted conversation context from the session-flush file (already at its final per-day location).
3. Skips if the same session was flushed within 60 seconds (dedup via `kb/x/memory/last-flush.json`).
4. Calls Claude Agent SDK with `prompts/flush.md` and the context.
5. Appends the structured result to `kb/calendar/notes/YYYY-MM-DD.md`.
6. Writes operational log lines to `kb/calendar/system/YYYY-MM-DD/log-memory.md` (raw log format, `.md` extension).
7. End-of-day auto-compilation: if past `COMPILE_AFTER_HOUR` and today's daily log changed since its last compile, spawns `compile.py` as another detached background process.

## Prompts

All LLM prompts live in `.systems/memory/prompts/`. They are plain-text markdown files with `{placeholder}` slots filled at runtime via `scripts/kb/utils.py:load_prompt`. See `prompts/README.md` for the index and `prompts/schema.md` for the article schema.

## State files

State is stored under `kb/x/memory/` as non-markdown artifacts:

- `state.json` — compile state. Maps each daily log filename to `{hash, compiled_at, cost_usd}`; also holds `query_count`, `last_lint`, `total_cost`. Grows by ~150 bytes per daily log compiled (one entry per day). Singleton, not rotated.
- `last-flush.json` — dedup state. Holds `{session_id, timestamp}` from the last flush. Overwritten on every flush, never grows.

Neither file is read by the LLM. Both are operational state used by `compile.py` and `flush.py`.

## Operational logs

Daily operational log files live at `kb/calendar/system/YYYY-MM-DD/log-memory.md`, one file per day per system. These are raw Python logging output saved with `.md` extension — markdown is a superset of plain text, so the extension is a no-op structurally but integrates cleanly with any LYT-compatible navigation.

Writers: all three hooks plus `flush.py`. Each log line has format `YYYY-MM-DD HH:MM:SS LEVEL [source] message`.

## Why index-guided retrieval works without RAG

At personal-knowledge-base scale (50–500 articles), the LLM reading a structured index outperforms cosine similarity. The LLM understands what the question is really asking and selects pages accordingly. Embeddings find similar words; the LLM finds relevant concepts.

## Scaling

At ~2,000+ articles / ~2M+ tokens, the index becomes too large for the context window. At that point, a hybrid RAG retrieval layer (keyword + semantic search) would be added before the LLM. See Karpathy's recommendation of `qmd` by Tobi Lutke for search at scale.

## Dependencies

`.systems/pyproject.toml` declares:

- `claude-agent-sdk>=0.1.29` — Claude Agent SDK for LLM calls with tool use
- `python-dotenv>=1.0.0` — Environment variable management
- `tzdata>=2024.1` — Timezone data

Python 3.12+, managed by [uv](https://docs.astral.sh/uv/). No API key needed — uses Claude Code's built-in credentials at `~/.claude/.credentials.json`.

## Costs

| Operation | Cost |
|-----------|------|
| Compile one daily log | $0.45–0.65 |
| Query (no file-back) | ~$0.15–0.25 |
| Query (with file-back) | ~$0.25–0.40 |
| Full lint (with contradictions) | ~$0.15–0.25 |
| Structural lint only | $0.00 |
| Memory flush (per session) | ~$0.02–0.05 |
