# Empowering Your AI App with Claude Skills Using the Vercel AI SDK

> **Source:** https://medium.com/@joachimhodana/empowering-your-ai-app-with-claude-skills-using-the-vercel-ai-sdk-38585e4f378f
> **Published:** February 2026 | **Author:** Joachim Hodana
>
> **Note:** Medium blocked automated access to this article. Content below was reconstructed from web search extracts and snippets. Some sections may be summarized. Refer to the original URL for the complete article.

---

## The Problem with Large Prompts

Large, unfocused context lowers precision. The model wastes attention on irrelevant instructions, signal gets diluted, and outputs become inconsistent. Multiple studies show that just increasing prompt length does not guarantee better performance -- and can hurt it.

## What Are Claude Skills

Despite the name, Claude Skills are **not** tools, functions, or API calls. They are **structured knowledge units** -- small, versioned "knowledge modules" where each one covers a narrow topic. Instead of embedding this knowledge directly into the system prompt, you store it in your repository and let the model access it dynamically.

Claude Skills represent an architectural choice rather than a prompting technique: domain rules are kept as small, versioned files and loaded only when the model explicitly asks for them via tool calls, instead of packing all knowledge into a growing system prompt.

## Why Skills Work Better

Retrieval-augmented approaches and modular context like Claude Skills outperform monolithic prompts because they limit context to what is actually relevant to the current request, instead of flooding the model with everything at once.

## SKILL.md Structure

Skills are defined in `SKILL.md` files with YAML frontmatter containing metadata followed by the skill rules and patterns in markdown format:

```yaml
---
name: sql-best-practices
version: 1.0.0
description: SQL query optimization rules and patterns
---

# SQL Best Practices

## Rules
- Always use parameterized queries
- Prefer JOINs over subqueries for readability
- Add indexes for frequently filtered columns
...
```

## Architecture: Two Tools, Lazy Loading

The model requests knowledge via tool calls while only exposing two tools:

1. **`list_skills`** -- Returns a small registry so the agent can discover what exists
2. **`load_skill`** -- Loads one skill file on demand (lazy loading), keeping the base context small

This is the progressive disclosure pattern: the agent sees a lightweight index at startup and loads full instructions only when the current task requires them.

## Implementation with Vercel AI SDK

The implementation uses `generateText` from the Vercel AI SDK with Anthropic's Claude model, configured with a system prompt that tells the agent it has access to skills stored as markdown files and can call `list_skills` first if unsure which skill to use.

```typescript
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';
import { tool } from 'ai';

const SKILLS_DIR = './skills';

// Tool: list available skills (lightweight registry)
const listSkills = tool({
  description: 'List all available skills with their names and descriptions',
  parameters: z.object({}),
  execute: async () => {
    const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
    const skills = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const content = await readFile(
          join(SKILLS_DIR, entry.name, 'SKILL.md'),
          'utf-8'
        );
        const frontmatter = parseFrontmatter(content);
        skills.push({
          name: frontmatter.name,
          description: frontmatter.description,
        });
      } catch {
        continue;
      }
    }

    return { skills };
  },
});

// Tool: load a specific skill by name
const loadSkill = tool({
  description: 'Load a skill file by name to get specialized instructions',
  parameters: z.object({
    name: z.string().describe('The skill name to load'),
  }),
  execute: async ({ name }) => {
    const skillPath = join(SKILLS_DIR, name, 'SKILL.md');
    const content = await readFile(skillPath, 'utf-8');
    return { content: stripFrontmatter(content) };
  },
});

// Run the agent
const result = await generateText({
  model: anthropic('claude-3-5-sonnet-20241022'),
  system: `You are a helpful assistant with access to skills stored as markdown files.
Call list_skills first if you are unsure which skill to use.
Call load_skill to read the full instructions for a specific skill.`,
  tools: {
    list_skills: listSkills,
    load_skill: loadSkill,
  },
  prompt: userMessage,
  maxSteps: 10,
});
```

## Common Mistakes

The most common mistake when implementing skills is still injecting file contents directly into the prompt. This defeats the whole purpose -- you are back to a large context, just assembled dynamically. You are not truly building skills but a bigger prompt.

The correct approach is to let the model **request** knowledge via tool calls, not pre-load everything into the system prompt.

## Key Takeaways

- **Context quality over quantity**: Smaller, focused context produces better results than large, unfocused prompts
- **Lazy loading via tool calls**: The model loads skill content only when it determines the current task needs it
- **Two-tool architecture**: `list_skills` for discovery, `load_skill` for retrieval -- keeps the base prompt minimal
- **Skills are knowledge, not code**: They are structured instructions, not executable functions
- **Progressive disclosure**: Start with metadata, expand to full content on demand
