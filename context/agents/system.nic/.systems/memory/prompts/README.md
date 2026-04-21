# Prompts Directory

This directory holds every LLM prompt used by the knowledge base agent. Prompts are plain-text markdown files with `{placeholder}` slots that Python fills in at runtime via `scripts/kb/utils.py:load_prompt`.

Keeping prompts out of the Python source has one purpose: **you can edit the agent's behavior per-domain without touching code.** The same codebase can be deployed as a healthcare-intake assistant, a personal journal, a research companion, or a software-engineering helper — each with its own prompts and nothing else.

## Files

| File | Used by | Purpose |
|------|---------|---------|
| `schema.md` | `scripts/kb/compile.py` | Article format spec (concept / connection / Q&A), frontmatter rules, wikilink conventions, quality standards |
| `flush.md` | `scripts/kb/flush.py` | Reads the session transcript and writes a daily-log entry |
| `compile.md` | `scripts/kb/compile.py` | Compiles a daily log into wiki articles (concepts, connections, HOME updates) |
| `query.md` | `scripts/kb/query.py` | Answers a user question by consulting the knowledge base |
| `query-file-back.md` | `scripts/kb/query.py` | Fragment appended to `query.md` when `--file-back` is set (archives the answer as a Q&A article) |
| `lint-contradictions.md` | `scripts/kb/lint.py` | Scans the full knowledge base for contradictions and inconsistencies |

## Placeholder syntax

Placeholders look like `{name}` and are filled via keyword arguments to `load_prompt`:

```python
from utils import load_prompt
prompt = load_prompt("flush.md", context=conversation_context)
```

Placeholder substitution is literal — no Python expressions inside the braces. Anything the prompt needs to interpolate must be pre-computed and passed as a named kwarg. Any `{word}` in the template that isn't provided as a kwarg stays untouched (no crash), so incidental curly braces in regular text are safe.

## Editing tips

- Keep each prompt self-contained. If two prompts share a chunk of text, duplicate it — a little duplication is cheaper than an indirection layer.
- If you change placeholder names, update the corresponding `load_prompt(...)` call in the Python code. Grep for the placeholder name to find callers.
- For domain adaptation (e.g., healthcare, journaling, research), fork the entire directory for each agent in your swarm. Each agent loads `prompts/` relative to its own root.
- `schema.md` is intentionally separate from `AGENTS.md`. `AGENTS.md` is architecture/developer docs; `schema.md` is the domain-specific article format the compiler follows. Rewrite `schema.md` freely per domain without touching architecture docs.
