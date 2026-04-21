# KNOWLEDGE_BASE.md

This file is the structural contract for everything under `kb/`. Any agent — this one or any future one — that writes to the knowledge base must read this file first and follow the conventions it describes.

This file describes **structure, not process**. It tells you *where* things live, *what form* they take, and *how they link together*. It does not tell you *when* something is processed, *who* triggers what, or *how* the system operates internally. Those concerns belong to each system's own documentation (for the memory system, see `.systems/memory/SYSTEM.md`), not here.

The knowledge base outlives any individual system that writes to it. Respect the structure.

---

## 1. Why this shape exists — the LYT mentality

The knowledge base is organized around **Linking Your Thinking (LYT)**, a method of personal knowledge management developed by Nick Milo. LYT is not about storing information — it is about **making sense of the world by connecting ideas**. The folder structure below is not arbitrary; it is the physical expression of a philosophy. If you understand the philosophy, the structure will make sense naturally, and you will know how to extend it without breaking it.

### 1.1 PKM — Personal Knowledge Management

From the LYT Kit glossary:

> PKM is "the process of individuals making, using, organizing, connecting, combining, collaborating, and creating with their personal notes."

More informally: PKM is **the process of making sense of the world**. It is not note-taking; it is note-making. It is not hoarding; it is synthesizing.

The central distinction is between:

- **Note-takers** — passive collectors. They clip, highlight, and save for later. Their notes are a cemetery.
- **Note-makers** — active sense-makers. They rewrite in their own words, connect ideas to other ideas, and let their notes become a thinking partner that grows with them.

Every agent that writes to this knowledge base must behave as a note-maker, not a note-taker. A file dropped into the inbox `kb/+/` is raw material; the notes you produce from it are the actual knowledge. Do not merely file things. Synthesize, connect, and explain in your own words. The binary is preserved for provenance; the note is the value.

### 1.2 LYT — Linking Your Thinking

LYT is the method of organizing knowledge around **rich linking** rather than rigid folders or tags. The core insight: the structure of knowledge is a network, not a tree. A concept belongs to many contexts at once; forcing it into a single category loses information. Links preserve the network.

In practice, LYT teaches:

- Notes are **atomic** — each note holds one idea, written in your own words.
- Notes are **linked** — every note has outbound links to related notes via `[[wikilinks]]`.
- **Backlinks** (the reverse direction of a link) are automatic in any LYT-compatible tool and are where most of the meaning lives. A note's value is determined largely by what links *into* it.
- Organization is **fluid** — rigid categories are avoided. Instead, **Maps of Content (MOCs)** are used to group related notes by theme, context, or effort.
- **Proximity creates meaning** — notes that coexist inside a MOC acquire meaning from their neighbors. The placement of a link inside a MOC is a deliberate statement: "these ideas belong together because...".
- **Heterarchy** — a single note can appear in many MOCs without belonging exclusively to any. This is how networks differ from trees.

The knowledge base you are writing to is a concrete application of LYT. The directory structure honors it. When you add a note, you are adding a vertex to a graph. When you link, you are adding an edge. When you create a map, you are declaring a new context in which those ideas cohere. Think in terms of the graph, not the folders.

### 1.3 ARC — Add, Relate, Communicate

ARC is the workflow LYT prescribes. It is a loop, not a line:

- **Add** — raw material enters the system. Conversations are captured. Files are dropped in `kb/+/`. Ideas are noted as they occur.
- **Relate** — raw material is synthesized. Concepts are extracted, notes are written, links are drawn, maps are refined. This is where note-making happens. Most agent time should be spent here.
- **Communicate** — finished outputs are produced for sharing. Copy for social media, reports, answers to questions, drafts of anything meant to leave the base. These are the **works** that the knowledge base enables.

The directory structure maps to ARC:

- `kb/+/` and `kb/calendar/notes/` are the **Add** layer (raw material entering).
- `kb/atlas/concepts/`, `kb/atlas/connections/`, `kb/atlas/maps/` are the **Relate** layer (synthesis).
- `kb/atlas/works/` is the **Communicate** layer (delivered outputs).
- `kb/effort/` is where Communicate outputs are *in progress* before they graduate to `works/` or elsewhere in Atlas.

### 1.4 ACE — Atlas, Calendar, Efforts

ACE is the folder framework LYT uses to partition knowledge by **purpose**, not topic:

- **Atlas** — the permanent reference layer. Spatial, atemporal. What you *know*. Concept articles, connections, maps, finished Q&As, delivered works. Atlas is where knowledge lives when it is no longer changing every day.
- **Calendar** — the temporal layer. Daily notes, future events, operational logs, time-stamped records of anything. If the information is meaningful only in relation to *when* it happened or will happen, it belongs here.
- **Efforts** — the active-work layer. Work in progress that will eventually graduate into Atlas (if it becomes reference) or be abandoned. Efforts is deliberately fluid — no deadlines, no fixed structure, just space for ideas and projects to develop over multiple passes.

The three layers have different tempos: Atlas is slow (permanent), Calendar is flowing (temporal), Efforts is fast and bursty (WIP).

A note that does not belong to Atlas, Calendar, or Efforts probably does not belong in this knowledge base at all.

### 1.5 MOC — Map of Content

A MOC is a **curated index note that groups related notes around a theme**. It is the most important higher-order note type in LYT. It is the primary mechanism by which knowledge becomes navigable and thinkable.

Key properties of a MOC:

- **Curatorial, not mechanical.** A MOC is hand-written. It is not auto-generated from tags or folders. The curation is the value.
- **Commentary between links.** A MOC is not just a list of links; it is a list of links with prose between them, explaining *why* these notes belong together and how they relate. The commentary is what distinguishes a MOC from a table of contents.
- **Spatial.** The physical arrangement of links inside a MOC matters. Notes placed next to each other acquire meaning by proximity. Move a link in a MOC and you change the meaning of both its neighbors.
- **Heterarchical.** A note can appear in multiple MOCs without belonging exclusively to any. The same concept might be in `atlas/maps/campanha-versao.md`, `atlas/maps/marketing-concepts.md`, and `atlas/maps/memory.md` for different reasons.
- **Emergent.** A MOC is created when you notice you are manually looking for "that cluster of notes" repeatedly — or when a project begins to emit enough notes that navigating them without a hub becomes painful. Do not create MOCs preemptively for topics that have only one or two notes.

The knowledge base's root MOC is `kb/HOME.md`. All other MOCs (and related higher-order notes) live under `kb/atlas/maps/`.

---

## 2. Supporting LYT concepts

These are the working vocabulary any agent operating on the base should internalize. They shape how you write, link, and when to create higher-order structures.

### Evergreen Notes

Notes that are "alive" and grow in value over time. Written in your own words, titled with a clear mini-thesis, linked to other notes, and **never finished**. The goal of most notes in `kb/atlas/concepts/` is to become evergreen: permanent, reusable, continuously refined.

The metaphor Milo uses: note-takers "churn and burn", note-makers "know and grow".

### BOAT Notes (Block of Atomic Thought)

Notes still in formation. Anything less than roughly 33% complete is a BOAT note. Adolescents to Evergreen's adults. It is acceptable (and sometimes preferable) to create a BOAT note and let it develop over multiple sessions rather than force artificial completeness on the first write. A BOAT note still gets frontmatter, but its body may be thin. Over time, a BOAT note grows toward Evergreen status.

### Higher-Order Notes

Notes composed primarily of **links to other notes**, rather than prose. The family includes:

- **MOC (Map of Content)** — the most active and curatorial
- **Hub Note** — more navigational, less curatorial
- **Index Note** — mechanical, like a generated summary
- **Structure Note**, **Workbench**, **Outline Note**, **Table of Contents** — variants with specific purposes

In practice the line between MOC and Hub blurs. In this knowledge base, **all higher-order notes live in `kb/atlas/maps/`**. The root higher-order note is `kb/HOME.md`.

### Heterarchy

A non-hierarchical mode of organization where elements can be grouped in multiple ways simultaneously. MOCs enable heterarchy: the same concept note can appear in many maps without being "owned" by any single one. Never force a note to belong to exactly one context.

### Proximity

The principle that spatial closeness creates meaning. LYT distinguishes three levels:

1. **Folder proximity** — weakest. Notes in the same folder have no intentional relationship.
2. **Subfolder proximity** — slightly stronger, but arbitrary.
3. **MOC proximity** — strongest. When you place one link next to another inside a MOC, you are making a deliberate claim about their relationship. This is the only kind of proximity that carries real meaning in LYT.

### Art of Link Curation (and Link Dilution)

Link with intention. Over-linking — connecting every note to every other note — is **Link Dilution**, the opposite of meaningful linking. Every link is a claim: "these two notes are related in a way that matters." If you cannot explain why a link exists, do not create it.

### Thought Collisions

Ideas grow in value when they bump into other ideas. A MOC is a deliberate "crowded room" where related notes are forced to coexist, maximizing the chance that new insights emerge from their collisions. This is why MOC placement and ordering matter.

### Mental Squeeze Point

The moment when the volume of information starts to overwhelm a knowledge base or an effort. It is a felt sensation — fatigue, disorientation, "where is anything?". The LYT antidote is not to reorganize the folders; it is to **create a new MOC** that provides a safe assembly space for the overwhelming topic. When you feel a Mental Squeeze Point on a region of the knowledge base, propose a new map.

### Fluid Taxonomies

Structure must adapt to thinking, not the reverse. If the knowledge base's current shape is getting in the way of synthesis, the shape is wrong — not the synthesis. Propose changes to the shape when you see them, but respect the contract in this file as a baseline until it is updated.

### Refraction Thinking

Thinking about ONE thing through the lens of ANOTHER thing. It is a tool for widening perspective, not for deciding action. A connection article in `kb/atlas/connections/` is often the trace of a refraction: "what does concept X look like when viewed through concept Y?".

### Progressive Ideation

The principle that the effort of thinking should compound over time. Every session should leave the knowledge base slightly richer than it was — new concepts extracted, new links drawn, new maps refined. This is the opposite of reinventing every time.

---

## 3. The knowledge base structure

```
kb/
├── HOME.md                          # root MOC — the master index
├── +/                               # inbox (Add layer) — external files awaiting ingestion
├── atlas/                           # reference, permanent
│   ├── concepts/                    #   atomic knowledge articles (Evergreen or BOAT)
│   ├── connections/                 #   cross-cutting syntheses linking 2+ concepts
│   ├── maps/                        #   higher-order notes (MOCs, Hubs, etc.)
│   ├── qa/                          #   finalized question-answer pairs
│   └── works/                       #   produced outputs delivered for Communicate
├── calendar/                        # temporal
│   ├── notes/                       #   daily conversation logs (past-facing)
│   │   └── YYYY-MM-DD.md
│   ├── events/                      #   future-facing notes (dated; past events stay here)
│   │   └── YYYY-MM-DD/
│   │       └── <slug>.md
│   └── system/                      #   system-generated operational records
│       ├── log.md                   #     global build log (every compile, ingest, query, lint)
│       └── YYYY-MM-DD/              #     per-day operational artifacts
│           ├── log-<system>.md      #       raw operational log of a specific system
│           ├── lint.md              #       lint report for that day
│           └── session-flush-<system>-*.md    # captured session contexts (if any)
├── effort/                          # active work in progress
│   ├── on/                          #   active projects
│   ├── simmering/                   #   paused projects (may be resumed)
│   └── off/                         #   abandoned projects (kept as record)
└── x/                               # non-markdown artifacts
    ├── files/                       #   binaries preserved from inbox ingestion
    └── <system>/                    #   per-system internal state (not LYT notes)
```

---

## 4. What each location holds

### `kb/HOME.md`

The root Map of Content. A single file. Contains a table listing every article in Atlas (concepts, connections, maps, qa, works) with one-line summaries, source citations, and last-updated dates. This is the primary retrieval mechanism: any agent answering a question reads `HOME.md` first to decide which articles to consult.

Format:

```markdown
# Knowledge Base Index

| Article | Summary | Compiled From | Updated |
|---------|---------|---------------|---------|
| [[concepts/article-slug]] | One-line summary | source-file | YYYY-MM-DD |
```

Every new or modified article in Atlas must have a corresponding row. Summaries are one line, self-contained, and rich enough to decide relevance without opening the article.

When `HOME.md` becomes long enough to be uncomfortable to scan, create sub-maps under `atlas/maps/` and refactor `HOME.md` to link to them instead of listing individual articles. This is the Mental Squeeze Point antidote applied at the root.

### `kb/+/` — Inbox

Transient staging area for external files about to be absorbed into the knowledge base. Files dropped here are **not permanent** — they are either consumed into notes or moved to `kb/x/files/` after processing. Do not reference `kb/+/` from any note; it is not a citation target.

### `kb/atlas/concepts/` — Concept articles

One article per atomic piece of knowledge: a fact, a pattern, a decision, a person, a place, an entity, a lesson. Written in encyclopedia style — neutral, factual, third-person where appropriate.

Frontmatter:

```yaml
---
title: "Concept Name"
aliases: [alternate-name, abbreviation]
tags: [domain, topic]
sources:
  - "calendar/notes/YYYY-MM-DD.md"
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

Body sections: a short core explanation, `## Key Points` (3–5 self-contained bullets), `## Details` (2+ paragraphs), `## Related Concepts` (2+ wikilinks), `## Sources` (back-references to the daily logs, files, or events that fed the article).

Concept articles are expected to evolve toward Evergreen status over time; BOAT status is acceptable on initial creation.

### `kb/atlas/connections/` — Connection articles

Cross-cutting synthesis linking 2+ concepts. Created when a non-obvious relationship between existing concepts becomes visible. Often the trace of refraction thinking: "what does X look like through the lens of Y?"

Frontmatter:

```yaml
---
title: "Connection: X and Y"
connects:
  - "concepts/x"
  - "concepts/y"
sources:
  - "calendar/notes/YYYY-MM-DD.md"
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

Body: `## The Connection`, `## Key Insight`, `## Evidence`, `## Related Concepts`.

### `kb/atlas/maps/` — Higher-order notes (MOCs and Hubs)

Curated notes that group related notes around a theme, context, project, or system. Hand-written commentary between the links is the point.

A map is appropriate when:

- A project emits multiple notes and needs a hub to describe how they relate (e.g., `atlas/maps/campanha-versao.md` for a launch campaign with research, copy, art concepts, and the final campaign).
- A theme accumulates enough articles that navigation requires a curated entry point.
- A system (infrastructure module) needs a self-description in LYT form (e.g., `atlas/maps/memory.md` describing the memory system's artifacts).

Do not create a map preemptively. Wait for the Mental Squeeze Point or for a project to emit at least 3–4 related notes.

Frontmatter (minimal):

```yaml
---
title: "Map: Theme or Project Name"
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

Body: prose commentary interleaved with `[[wikilinks]]` to the notes this map gathers. Placement of links is intentional.

### `kb/atlas/qa/` — Finalized Q&A

Question-answer pairs produced by the querying pipeline once they are ready for permanent reference. The query produces a full answer synthesized from existing articles; that answer is filed here when it has lasting value.

Frontmatter:

```yaml
---
title: "Q: Original Question"
question: "The exact question asked"
consulted:
  - "concepts/article-1"
filed: YYYY-MM-DD
---
```

Body: `## Answer` (with wikilink citations), `## Sources Consulted`, `## Follow-Up Questions`.

### `kb/atlas/works/` — Delivered productions

Finished outputs produced by the agent and delivered: social copy, reports, drafts, any artifact meant to leave the base or be used externally. This is the **Communicate** layer of ARC.

Works are **flat** — no subfolders. When a work is part of a larger project that emits multiple related works, a map in `atlas/maps/<project>.md` binds them together via its curated links and commentary.

Frontmatter:

```yaml
---
title: "Work Title"
work_type: social-copy | report | draft | ...  (freeform)
delivered_at: YYYY-MM-DD
origin: "effort/on/<project-slug>.md"            (or wherever the effort lived)
---
```

Body: the work itself. Source references go in a final `## Sources` section with wikilinks to the concepts, daily logs, or events that informed the work.

### `kb/calendar/notes/` — Daily conversation logs

One file per day. Append-only, immutable once written (do not rewrite history). Captures what happened in the agent's interactions that day. This is raw material — not a final article, but the source from which articles are compiled.

### `kb/calendar/events/` — Dated notes about the future

Notes attached to a future date. One subfolder per day, one file per event: `kb/calendar/events/YYYY-MM-DD/<slug>.md`.

Frontmatter:

```yaml
---
title: "Event Title"
date: YYYY-MM-DD
time: HH:MM             # optional; omit for all-day events
atendido: false
created: YYYY-MM-DD
---
```

`atendido` becomes `true` once the event has been processed. Past events remain in place; they are not moved out of `events/`. Temporal notes live in Calendar — regardless of whether they point to the future or the past.

The body of an event is a regular note: anything relevant to the event. This file does not prescribe what an event contains or how it is acted upon — those concerns belong to each system that reads events, not to the structure.

### `kb/calendar/system/` — System-generated operational records

Everything here is written by code, not by note-makers. Do not edit by hand.

- `log.md` — the global build log. A single append-only file recording every compile, ingest, query, and lint operation with timestamps, inputs, and outputs. This is the chronology of the knowledge base.
- `YYYY-MM-DD/log-<system>.md` — per-day raw operational log of a specific system. Python `logging` output, `.md` extension so it integrates with LYT navigation.
- `YYYY-MM-DD/lint.md` — lint report for that day.
- `YYYY-MM-DD/session-flush-<system>-*.md` — captured session contexts, raw.

The filename convention (`<system>` prefix) lets multiple systems share the same per-day folder without nested subdirectories.

### `kb/effort/` — Work in progress

Active work that will graduate out of `effort/` when finished. Three subfolders track lifecycle:

- `on/` — active projects, being worked on now.
- `simmering/` — paused but alive; may be resumed.
- `off/` — abandoned. Kept as a record of what was tried and why it stopped.

**A project note's final destination is not `effort/off/`.** When a project is completed successfully, its notes move out of `effort/` entirely:

- A delivered work goes to `atlas/works/`.
- A finalized Q&A goes to `atlas/qa/`.
- A new concept that emerged goes to `atlas/concepts/`.
- A project that emitted multiple related notes gets a map in `atlas/maps/<project-slug>.md` that references where each piece ended up.

`effort/off/` is only for abandonment, not for successful completion.

A project note in effort may have frontmatter like:

```yaml
---
title: "Project Name"
status: on | simmering | off
started: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

The `status` field should match the subfolder the note lives in.

### `kb/x/` — Non-markdown artifacts

Binaries, state files, anything that is not a markdown note. LYT's convention — and this knowledge base's rule — is that **everything in `x/` must be reachable from a markdown note via a wikilink**. `x/` is not a dumping ground.

- `kb/x/files/` — binaries preserved from inbox ingestion (PDFs, images, audio, source files that should be kept alongside the concept articles derived from them). Referenced from those concept articles via `[[x/files/<name>]]` in the `Sources` section.
- `kb/x/<system>/` — per-system internal state (e.g., `kb/x/memory/state.json`, `kb/x/memory/last-flush.json`). Referenced from that system's map in `atlas/maps/<system>.md`.

Files in `x/` that are not referenced from any note are orphans and should be flagged by lint.

---

## 5. Invariants

These rules hold across all categories. Any write to the knowledge base must preserve them.

1. **Every article must have complete YAML frontmatter.** At minimum: `title`, `created`, `updated`. Category-specific fields as listed above.
2. **Every article must have at least 2 outbound `[[wikilinks]]` to other notes.** This supports the graph and enables heterarchical navigation. BOAT notes may start with fewer links but should grow toward this bar.
3. **Every new or modified article in Atlas must appear in `HOME.md`** with a row containing title, summary, source, and updated date. No article is orphaned from the index.
4. **Every binary in `kb/x/files/`** — and every non-markdown artifact anywhere in `x/` — **must be wikilinked from at least one note.** Unreferenced binaries are orphans.
5. **Wikilinks use Obsidian shortest-path form** without the `.md` extension: `[[concepts/slug]]`, not `[[atlas/concepts/slug.md]]`.
6. **Dates follow ISO 8601.** `YYYY-MM-DD` for dates, full ISO (`YYYY-MM-DDTHH:MM:SS±TZ`) for timestamps.
7. **File names are kebab-case, lowercase.** `supabase-row-level-security.md`, not `Supabase RLS.md`.
8. **Daily logs (`calendar/notes/YYYY-MM-DD.md`) are append-only.** Never rewrite history.
9. **`calendar/system/` is system-generated.** Do not edit those files by hand.
10. **Link with intention; do not dilute.** A link is a claim that two notes are meaningfully related. If you cannot state the relationship, omit the link.
11. **Favor updating existing notes over creating near-duplicates.** When ingesting new material on a topic that already has a concept article, merge the new information into the existing article and add the new source to its frontmatter.
12. **Maps emerge from need, not planning.** Do not create a map in `atlas/maps/` for a theme that has fewer than ~3–4 related notes. Wait for the Mental Squeeze Point or for a project to earn the map by its scope.

---

## 6. A note on our Efforts semantics

LYT's strict definition of **Efforts** (from the Milo glossary) is narrower than how this knowledge base uses the term. Strictly, an Effort in LYT is "a fluid, non-deadlined idea you feel a spark of wanting to share." In this knowledge base, `kb/effort/` is broader: it holds any work in progress that will eventually graduate to a final destination in Atlas — copy drafts awaiting approval, research phases of a campaign, interactive refinements of a Q&A, and so on.

This is a deliberate divergence. Use `kb/effort/` for any multi-step work that cannot be completed in a single pass and will eventually produce one or more notes that move to `atlas/concepts/`, `atlas/connections/`, `atlas/qa/`, `atlas/works/`, or `atlas/maps/`. Do not worry about whether a particular effort fits the strict LYT definition.

---

## 7. What this file does not cover

This file is a structural contract, not an operational manual. It does not describe:

- How files arrive in the inbox or who puts them there.
- When hooks fire, which scripts run, or how systems trigger operations.
- What an event's body should contain or how an agent acts on it when its date arrives.
- How a system decides to create a new concept versus update an existing one.
- The internal mechanics of the memory system, the ingestion pipeline, or any other `.systems/<slug>/` module.

Those concerns belong to each system's own documentation. For the memory system, see `.systems/memory/SYSTEM.md`. Other systems, when they exist, will have analogous documentation in their own `.systems/<slug>/` directory.

If you find yourself unsure whether a particular rule belongs in this file, apply this test: **would the same rule hold if a different system were writing to the same knowledge base?** If yes, it belongs here. If the rule depends on a particular system's implementation, it belongs in that system's own docs.
