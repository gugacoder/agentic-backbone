# Use Skills in Your AI SDK Agents via Bash Tool

> **Source:** https://vercel.com/changelog/use-skills-in-your-ai-sdk-agents-via-bash-tool
> **Published:** January 21, 2026 | **Author:** Malte Ubl

---

## Overview

The `bash-tool` package now supports skills, enabling AI SDK agents to leverage "the skills pattern with filesystem context, Bash execution, and sandboxed runtime access." This integration provides agents with a uniform approach to retrieving task-specific context through isolated execution environments.

## Key Capabilities

Developers can integrate either publicly available skills from the skills registry or create custom proprietary skills for private agent use. The implementation maintains consistent behavior across context retrieval and execution models.

## Implementation Example

```typescript
import {
  experimental_createSkillTool as createSkillTool,
  createBashTool,
} from "bash-tool";
import { ToolLoopAgent } from "ai";

// Discover skills and get files to upload
const { skill, files, instructions } = await createSkillTool({
  skillsDirectory: "./skills",
});

// Create bash tool with skill files
const { tools } = await createBashTool({
  files,
  extraInstructions: instructions,
});

// Use both tools with an agent
const agent = new ToolLoopAgent({
  model,
  tools: { skill, ...tools },
});
```

## How It Works

1. `createSkillTool` scans the specified skills directory, discovering all available skills and their metadata
2. It returns a `skill` tool (for the agent to load skills on demand), the `files` to upload to the sandbox, and `instructions` to append to the system prompt
3. `createBashTool` receives the skill files and extra instructions, making them accessible within the sandboxed Bash environment
4. The agent can then use both the skill loading tool and the bash tool together -- loading skill instructions when needed, and executing scripts or reading files from the skill's directory

## Integration with the Skills Ecosystem

This changelog entry represents the bridge between the Agent Skills open format and the AI SDK's execution model. Skills installed via `npx skills add <owner/repo>` are automatically discoverable by `createSkillTool` when placed in the configured skills directory.

## Additional Resources

- [Agent Skills Guide](https://ai-sdk.dev/cookbook/guides/agent-skills)
- [bash-tool package documentation](https://www.npmjs.com/package/bash-tool)
- [Skills CLI](https://www.npmjs.com/package/skills)
