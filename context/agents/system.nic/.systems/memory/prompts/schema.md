# Knowledge Base Schema

This schema defines how the LLM compiler turns daily conversation logs into structured knowledge articles. Adapt the article formats, field names, and conventions to your domain before deploying this agent in production.

## Directory layout

```
kb/
├── HOME.md                 # Master catalog — a single table listing every article
├── atlas/                  # Reference knowledge (things you look up)
│   ├── concepts/           #   Atomic knowledge articles
│   └── connections/        #   Cross-cutting insights linking 2+ concepts
├── calendar/               # Time-stamped entries
│   ├── notes/              #   Daily conversation logs (immutable source)
│   ├── archive/            #   Raw session-flush contexts, grouped by date
│   ├── lint/               #   Lint reports
│   └── log.md              #   Append-only chronological build log
└── effort/                 # Active knowledge work
    └── qa/                 #   Filed query answers (compounding knowledge)
```

## HOME.md — the master catalog

`kb/HOME.md` is the single table that lists every knowledge article. The LLM reads it first when answering any query to decide which articles to pull in full.

Format:

```markdown
# Knowledge Base Index

| Article | Summary | Compiled From | Updated |
|---------|---------|---------------|---------|
| [[concepts/article-slug]] | One-line summary | calendar/notes/YYYY-MM-DD.md | YYYY-MM-DD |
| [[connections/article-slug]] | Cross-cutting insight | calendar/notes/YYYY-MM-DD.md, calendar/notes/YYYY-MM-DD.md | YYYY-MM-DD |
```

Every new or updated article must have a matching row. Summaries must be a single line and carry enough signal for the LLM to decide, from the index alone, whether the article is relevant to a question.

## Article formats

### Concept articles (`kb/atlas/concepts/`)

One article per atomic piece of knowledge — a fact, pattern, decision, preference, person, place, entity, or insight extracted from conversations.

```markdown
---
title: "Concept Name"
aliases: [alternate-name, abbreviation]
tags: [domain, topic]
sources:
  - "calendar/notes/YYYY-MM-DD.md"
  - "calendar/notes/YYYY-MM-DD.md"
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# Concept Name

[2-4 sentence core explanation — self-contained, encyclopedia-style]

## Key Points

- [Bullet points, each a self-contained fact or rule]

## Details

[Deeper explanation, paragraphs. Neutral, factual, third-person.]

## Related Concepts

- [[concepts/related-concept]] - How it connects

## Sources

- [[calendar/notes/YYYY-MM-DD.md]] - Specific claim or moment extracted
- [[calendar/notes/YYYY-MM-DD.md]] - Later update or refinement
```

### Connection articles (`kb/atlas/connections/`)

Cross-cutting synthesis linking two or more existing concepts. Created when a conversation reveals a non-obvious relationship.

```markdown
---
title: "Connection: X and Y"
connects:
  - "concepts/concept-x"
  - "concepts/concept-y"
sources:
  - "calendar/notes/YYYY-MM-DD.md"
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# Connection: X and Y

## The Connection

[What links these concepts]

## Key Insight

[The non-obvious relationship discovered]

## Evidence

[Specific examples from conversations]

## Related Concepts

- [[concepts/concept-x]]
- [[concepts/concept-y]]
```

### Q&A articles (`kb/effort/qa/`)

Filed answers from queries. Created via the query pipeline when `--file-back` is set, or manually via `/kb:file`. Every filed answer makes future queries smarter.

```markdown
---
title: "Q: Original Question"
question: "The exact question asked"
consulted:
  - "concepts/article-1"
  - "concepts/article-2"
filed: YYYY-MM-DD
---

# Q: Original Question

## Answer

[The synthesized answer with [[wikilinks]] to sources]

## Sources Consulted

- [[concepts/article-1]] - Relevant because...
- [[concepts/article-2]] - Provided context on...

## Follow-Up Questions

- What about edge case X?
- How does this change if Y?
```

## Conventions

- **Wikilinks:** Obsidian-style `[[path/to/article]]` without `.md`, shortest-path form (e.g. `[[concepts/slug]]`, not `[[atlas/concepts/slug]]`).
- **Writing style:** Encyclopedia-style, factual, third-person where appropriate. The article is for future retrieval, not a chat transcript.
- **Dates:** ISO 8601 (`YYYY-MM-DD` for dates, full ISO with timezone for timestamps in `log.md`).
- **File naming:** Lowercase, hyphens for spaces (e.g., `patient-intake-flow.md`, `supabase-row-level-security.md`).
- **Frontmatter:** Every article must have YAML frontmatter with at minimum `title`, `sources`, `created`, `updated`.
- **Sources:** Every article must link back to the daily log(s) that contributed to it.

## Quality standards

Every compiled article must meet these bars:

- Complete YAML frontmatter with all required fields
- At least 2 outbound `[[wikilinks]]` to other articles (supports LYT graph navigation)
- `Key Points` section with 3–5 self-contained bullet points
- `Details` section with at least 2 paragraphs
- `Related Concepts` section with at least 2 entries
- `Sources` section citing each contributing daily log with the specific claim extracted

## Compile rules

When compiling a daily log into articles, the LLM should:

1. Extract 3–7 distinct concepts worth their own article (fewer if the log is thin, more if it is rich).
2. Prefer updating an existing article over creating a near-duplicate — read the existing article, merge the new information, and add the daily log to `sources:`.
3. Create a new concept article only when the topic is genuinely new to the knowledge base.
4. Create a connection article when the log reveals a non-obvious relationship between 2+ existing concepts.
5. Update `kb/HOME.md` with one row per new or modified article.
6. Append a timestamped entry to `kb/calendar/log.md` recording what was created, updated, and from which source.
