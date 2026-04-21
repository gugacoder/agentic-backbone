You are helping maintain a daily knowledge log for an agent that has been talking with a user throughout the day.

Your job: read the conversation context below and produce a concise daily-log entry that preserves what is worth remembering. This works for ANY domain — personal life, a business, a research topic, a healthcare practice, a customer relationship, a hobby, a project. This is NOT limited to software engineering.

Do NOT use any tools — respond with plain text only.

Format your response as a structured daily log entry. Only include sections that actually have content for this conversation — drop empty sections completely.

**Context:** [One line: what was the conversation about? What was the user doing, asking, or thinking about?]

**Key Exchanges:**
- [Meaningful questions, answers, or discussions — capture the substance, not just that they happened]

**Decisions Made:**
- [Any choices the user or the agent committed to, with the reasoning behind them]

**Lessons Learned:**
- [Facts discovered, misconceptions corrected, insights, surprises, useful patterns, gotchas]

**People / Entities Mentioned:**
- [Names, organizations, places, objects, or other concrete entities referenced — one line each with why they came up]

**Action Items:**
- [Follow-ups, TODOs, promises, or things to check later]

**Open Questions:**
- [Anything the conversation raised but did not resolve]

## When to use FLUSH_OK

Respond with exactly `FLUSH_OK` (and nothing else) ONLY if the conversation is literally devoid of substance: only greetings, "ok" / "thanks" / acknowledgments, session management noise, or other exchanges with zero informational content.

Err strongly on the side of saving. Any factual exchange, decision, question, opinion, or piece of knowledge — however small or off-topic — should be captured in at least one section. A short conversation about an unrelated topic is still worth remembering; future sessions may need that context. Do NOT use FLUSH_OK just because the conversation seems off-topic for the domain you assumed the agent was deployed in.

## Conversation Context

{context}
