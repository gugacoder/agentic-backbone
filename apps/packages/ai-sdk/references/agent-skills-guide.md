# Add Skills to Your Agent

> **Source:** https://ai-sdk.dev/cookbook/guides/agent-skills

---

## Overview

This guide teaches extending agents with Agent Skills -- a lightweight, open format for adding specialized knowledge from markdown files loaded at runtime.

A skill is fundamentally "a folder containing a `SKILL.md` file with metadata and instructions that tell an agent how to perform a specific task."

```
my-skill/
├── SKILL.md          # Required: instructions + metadata
├── scripts/          # Optional: executable code
├── references/       # Optional: documentation
└── assets/           # Optional: templates, resources
```

## How Skills Work

Skills implement progressive disclosure for efficient context management:

1. **Discovery**: Agents load only skill names and descriptions at startup
2. **Activation**: When a task matches a skill's description, the agent reads the full `SKILL.md` instructions
3. **Execution**: The agent follows instructions and loads referenced files or executes bundled code as needed

## The SKILL.md File

Every skill requires a `SKILL.md` file with YAML frontmatter and Markdown instructions:

```yaml
---
name: pdf-processing
description: Extract text and tables from PDF files, fill forms, merge documents.
---

# PDF Processing

## When to use this skill
Use this skill when the user needs to work with PDF files...

## How to extract text
1. Use pdfplumber for text extraction...

## How to fill forms
...
```

Required frontmatter fields:
- `name`: Short identifier
- `description`: Instructions for when to use this skill

The Markdown body has no structural restrictions.

## Prerequisites

Your agent needs:

1. **Filesystem access** to discover and load skill files
2. **A load skill tool** that reads `SKILL.md` content into context
3. **Command execution** (optional) for bundled scripts

## Step 1: Define a Sandbox Abstraction

Create a generic sandbox interface for flexible environment implementation:

```ts
interface Sandbox {
  readFile(path: string, encoding: 'utf-8'): Promise<string>;
  readdir(
    path: string,
    opts: { withFileTypes: true },
  ): Promise<{ name: string; isDirectory(): boolean }[]>;
  exec(command: string): Promise<{ stdout: string; stderr: string }>;
}
```

## Step 2: Discover Skills at Startup

Scan skill directories and extract metadata from each `SKILL.md`:

```ts
interface SkillMetadata {
  name: string;
  description: string;
  path: string;
}

async function discoverSkills(
  sandbox: Sandbox,
  directories: string[],
): Promise<SkillMetadata[]> {
  const skills: SkillMetadata[] = [];
  const seenNames = new Set<string>();

  for (const dir of directories) {
    let entries;
    try {
      entries = await sandbox.readdir(dir, { withFileTypes: true });
    } catch {
      continue; // Skip directories that don't exist
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillDir = `${dir}/${entry.name}`;
      const skillFile = `${skillDir}/SKILL.md`;

      try {
        const content = await sandbox.readFile(skillFile, 'utf-8');
        const frontmatter = parseFrontmatter(content);

        // First skill with a given name wins (allows project overrides)
        if (seenNames.has(frontmatter.name)) continue;
        seenNames.add(frontmatter.name);

        skills.push({
          name: frontmatter.name,
          description: frontmatter.description,
          path: skillDir,
        });
      } catch {
        continue; // Skip skills without valid SKILL.md
      }
    }
  }
  return skills;
}

function parseFrontmatter(content: string) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match?.[1]) throw new Error('No frontmatter found');
  // Parse YAML using your preferred library
  return yaml.parse(match[1]);
}
```

## Step 3: Build the System Prompt

Include discovered skills in the system prompt:

```ts
function buildSkillsPrompt(skills: SkillMetadata[]): string {
  const skillsList = skills
    .map(s => `- ${s.name}: ${s.description}`)
    .join('\n');

  return `
## Skills

Use the \`loadSkill\` tool to load a skill when the user's request
would benefit from specialized instructions.

Available skills:
${skillsList}
`;
}
```

The agent sees only names and descriptions; full instructions remain outside the context window until loaded.

## Step 4: Create the Load Skill Tool

The load skill tool reads the full `SKILL.md` and returns the body without frontmatter:

```ts
function stripFrontmatter(content: string): string {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return match ? content.slice(match[0].length).trim() : content.trim();
}

const loadSkillTool = tool({
  description: 'Load a skill to get specialized instructions',
  inputSchema: z.object({
    name: z.string().describe('The skill name to load'),
  }),
  execute: async ({ name }, { experimental_context }) => {
    const { sandbox, skills } = experimental_context as {
      sandbox: Sandbox;
      skills: SkillMetadata[];
    };

    const skill = skills.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (!skill) {
      return { error: `Skill '${name}' not found` };
    }

    const skillFile = `${skill.path}/SKILL.md`;
    const content = await sandbox.readFile(skillFile, 'utf-8');
    const body = stripFrontmatter(content);

    return {
      skillDirectory: skill.path,
      content: body,
    };
  },
});
```

The tool returns both the skill directory path and content, enabling the agent to construct full paths to bundled resources.

## Step 5: Create the Agent

Wire up the sandbox and skills using `callOptionsSchema` and `prepareCall`:

```ts
const callOptionsSchema = z.object({
  sandbox: z.custom<Sandbox>(),
  skills: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      path: z.string(),
    }),
  ),
});

const readFileTool = tool({
  description: 'Read a file from the filesystem',
  inputSchema: z.object({ path: z.string() }),
  execute: async ({ path }, { experimental_context }) => {
    const { sandbox } = experimental_context as { sandbox: Sandbox };
    return sandbox.readFile(path, 'utf-8');
  },
});

const bashTool = tool({
  description: 'Execute a bash command',
  inputSchema: z.object({ command: z.string() }),
  execute: async ({ command }, { experimental_context }) => {
    const { sandbox } = experimental_context as { sandbox: Sandbox };
    return sandbox.exec(command);
  },
});

const agent = new ToolLoopAgent({
  model: yourModel,
  tools: {
    loadSkill: loadSkillTool,
    readFile: readFileTool,
    bash: bashTool,
  },
  callOptionsSchema,
  prepareCall: ({ options, ...settings }) => ({
    ...settings,
    instructions: `${settings.instructions}\n\n${buildSkillsPrompt(options.skills)}`,
    experimental_context: {
      sandbox: options.sandbox,
      skills: options.skills,
    },
  }),
});
```

## Step 6: Run the Agent

```ts
// Create sandbox (your filesystem/execution abstraction)
const sandbox = createSandbox({ workingDirectory: process.cwd() });

// Discover skills at startup
const skills = await discoverSkills(sandbox, [
  '.agents/skills',
  '~/.config/agent/skills',
]);

// Run the agent
const result = await agent.run({
  prompt: userMessage,
  options: { sandbox, skills },
});
```

When a user request matches a skill description, the agent calls `loadSkill`. Full instructions load into context, and the agent follows them using `bash` and `readFile` to access bundled resources.

## Accessing Bundled Resources

Skills can reference files relative to their directory. The agent uses existing tools to access them:

```markdown
Skill directory: /path/to/.agents/skills/my-skill

# My Skill Instructions

Read the configuration template:
templates/config.json

Run the setup script:
bash scripts/setup.sh
```

The agent sees the skill directory path in the tool result and prepends it when accessing resources. No special resource loading mechanism is required -- the agent uses the same tools it uses for everything else.

## Learn More

- Agent Skills specification for full format details
- Example skills on GitHub
- Authoring best practices for writing effective skills
- Reference library to validate skills and generate prompt XML
- [skills.sh](https://skills.sh/) to browse and discover community skills
