# LLM Personal Knowledge Base

**Your AI conversations compile themselves into a searchable knowledge base.**

Adapted from [Karpathy's LLM Knowledge Base](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) architecture, organized using the [LYT](https://www.linkingyourthinking.com/) methodology (ACE folders, MOCs, atomic notes). Instead of clipping web articles, the raw data is your own conversations with Claude Code. When a session ends (or auto-compacts mid-session), Claude Code hooks capture the conversation transcript and spawn a background process that uses the [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk) to extract the important stuff - decisions, lessons learned, patterns, gotchas - and appends it to a daily log. You then compile those daily logs into structured, cross-referenced knowledge articles organized by concept. Retrieval uses a simple index file instead of RAG - no vector database, no embeddings, just markdown.

Anthropic has clarified that personal use of the Claude Agent SDK is covered under your existing Claude subscription (Max, Team, or Enterprise) - no separate API credits needed.

## Quick Start

Tell your AI coding agent:

> "Clone the lyt-memory-compiler template into this project. Set up the Claude Code hooks so my conversations automatically get captured into daily logs, compiled into a knowledge base, and injected back into future sessions. Read the AGENTS.md for the full technical reference on how everything works."

The agent will:
1. Copy the template files and run `uv sync` to install dependencies
2. Set up `.claude/settings.json` with the hooks and `/kb:*` commands
3. The hooks activate automatically next time you open Claude Code
4. The `kb/` directory tree is created on first flush

## How It Works

```
Conversation → SessionEnd/PreCompact hooks → flush.py extracts knowledge
    → kb/calendar/notes/YYYY-MM-DD.md → compile.py → kb/atlas/, kb/effort/
        → SessionStart hook injects kb/HOME.md into next session → cycle repeats
```

- **Hooks** (`scripts/hooks/`) capture conversations automatically (session end + pre-compaction safety net)
- **flush.py** (`scripts/kb/`) calls the Claude Agent SDK to decide what's worth saving, and after 6 PM triggers end-of-day compilation automatically
- **compile.py** turns daily logs into organized concept articles with cross-references
- **query.py** answers questions using index-guided retrieval (no RAG needed at personal scale)
- **lint.py** runs 7 health checks (broken links, orphans, contradictions, staleness)

## Slash Commands

```
/kb            — Status overview + subcommand list
/kb:digest     — Compile notes into atlas articles
/kb:ask        — Ephemeral KB query
/kb:audit      — Run health checks
/kb:capture    — Extract memories from current session
/kb:note       — Manual entry in today's daily log
/kb:file       — Archive Q&A deliberately
/kb:review     — Review code against KB patterns
/kb:check      — Validate approach against prior decisions
```

## CLI

```bash
uv run python scripts/kb/compile.py                    # compile new daily logs
uv run python scripts/kb/query.py "question"            # ask the knowledge base
uv run python scripts/kb/query.py "question" --file-back # ask + save answer back
uv run python scripts/kb/lint.py                        # run health checks
uv run python scripts/kb/lint.py --structural-only      # free structural checks only
```

## Directory Layout

```
{project}/
├── kb/                    # Generated at runtime
│   ├── HOME.md            # Master index (MOC)
│   ├── atlas/             # Compiled knowledge
│   ├── calendar/          # Daily logs + lint reports
│   └── effort/            # Q&A articles
├── scripts/               # From template
│   ├── hooks/             # Claude Code hooks
│   └── kb/                # KB operation scripts
├── work/                  # Agent working directory
│   └── {slug}/            # One subfolder per project
└── .claude/               # From template
    ├── settings.json      # Hook config
    └── commands/kb/       # /kb:* slash commands
```

## Why No RAG?

Karpathy's insight: at personal scale (50-500 articles), the LLM reading a structured `HOME.md` outperforms vector similarity. The LLM understands what you're really asking; cosine similarity just finds similar words. RAG becomes necessary at ~2,000+ articles when the index exceeds the context window.

## Technical Reference

See **[AGENTS.md](AGENTS.md)** for the complete technical reference: article formats, hook architecture, script internals, cross-platform details, costs, and customization options.
