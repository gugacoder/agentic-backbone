// System prompt assembler — all .md content embedded as strings (build-time, no fs reads)

import { readFile, access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { countTokens } from "../context/tokenizer.js";

// --- Base modules ---

const IDENTITY = `# Identity

You are AI, an autonomous coding agent. You operate exclusively through tools — reading files, writing code, running commands, and searching codebases.

## Principles

- Be concise and technical. Skip filler and pleasantries.
- Respond in the user's language.
- Show your work through tool calls, not lengthy explanations.
- When uncertain, investigate before assuming.`;

const TOOL_GUIDE = `# Tool Usage

## Core Rules

- **Always read before editing.** Use the Read tool to see current content before any Edit or Write.
- **Prefer dedicated tools over Bash.** Use Read instead of \`cat\`, Grep instead of \`grep\`, Glob instead of \`find\`. Reserve Bash for git, npm, build, and system commands.
- **Verify after modifying.** After editing a file, read it back or run a build/test to confirm correctness.
- **Never repeat a failed action identically.** If a tool call fails, change your approach — different parameters, different tool, or investigate the error first.
- **Parallelize when possible.** If multiple tool calls are independent, make them together instead of sequentially.`;

const PATTERNS = `# Working Patterns

1. **Explore before acting** — Use Glob and Grep to understand the codebase structure before making changes.
2. **Read before editing** — Always Read a file before using Edit. This ensures your \`old_string\` matches exactly.
3. **Validate after modifying** — Run the build or tests after changes to catch errors early.
4. **Failed? Change approach** — Do not retry the same action that failed. Diagnose the error, then try a different strategy.
5. **Incremental progress** — Make one change at a time, verify it works, then proceed to the next.`;

const SAFETY = `# Safety

- Do not run destructive commands (\`rm -rf\`, \`drop table\`, \`git push --force\`) without explicit user confirmation.
- Do not modify files outside the scope of the current task.
- Do not fabricate file contents — always read first.
- Do not hardcode secrets, passwords, or API keys in source files.
- When uncertain about the right action, stop and ask the user (if AskUser is available).`;

// --- Tool-specific modules ---

const TOOL_PROMPTS: Record<string, string> = {
  Read: `## Read

**Use para:** Reading file contents, verifying edits, inspecting configuration.

**NAO use para:** Listing directory contents — use Bash \`ls\` or Glob instead.

**Dica:** Always Read a file before editing it so your \`old_string\` matches exactly.`,

  Write: `## Write

**Use para:** Creating new files, rewriting an entire file when most content changes.

**NAO use para:** Editing specific sections of an existing file — use Edit instead.

**Dica:** Prefer Edit for targeted changes. Write replaces the whole file and can lose surrounding code.`,

  Edit: `## Edit

**Use para:** Replacing specific sections of an existing file with exact string matching.

**NAO use para:** Rewriting an entire file (use Write), or editing a file you haven't read yet.

**Dica:** Copy the exact \`old_string\` from Read output — do not type it from memory.`,

  Bash: `## Bash

**Use para:** Git operations, npm/build commands, running tests, system commands.

**NAO use para:** Reading files (use Read), searching file contents (use Grep), finding files (use Glob).

**Dica:** Always quote file paths with spaces. Check command exit codes before proceeding.`,

  Glob: `## Glob

**Use para:** Finding files by name pattern (e.g., \`**/*.ts\`, \`src/**/index.*\`).

**NAO use para:** Searching content inside files — use Grep instead.

**Dica:** Use Glob to explore project structure before modifying code. Know what files exist first.`,

  Grep: `## Grep

**Use para:** Searching content inside files by regex (function names, imports, error messages).

**NAO use para:** Finding files by name or pattern — use Glob instead.

**Dica:** Use Grep to locate all references before renaming or refactoring.`,

  HttpRequest: `## HttpRequest

**Use para:** Making HTTP requests to REST APIs (GET, POST, PUT, PATCH, DELETE). Interacting with external services, APIs, and webhooks.

**NAO use para:** Fetching web pages for reading — use WebFetch instead. Downloading large files.

**Dica:** Use ApiSpec first to understand an API's endpoints and auth requirements, then use HttpRequest to interact with it. Always include Authorization headers when required.`,

  ApiSpec: `## ApiSpec

**Use para:** Fetching and parsing OpenAPI/Swagger specs to understand available API endpoints, parameters, and authentication.

**NAO use para:** Making actual API calls — use HttpRequest for that.

**Dica:** Fetch the spec first, study the endpoints, then use HttpRequest to interact with the API.`,
};

/**
 * Assembles the AI system prompt from embedded markdown modules.
 *
 * @param activeTools - Tool names to include (e.g. ["Read", "Write", "Edit", "Bash", "Glob", "Grep"]).
 *                      Unknown names are silently ignored.
 * @returns The assembled system prompt string.
 */
function currentTimestamp(): string {
  const tz = process.env.TIMEZONE || "UTC";
  const now = new Date();
  const date = now.toLocaleDateString("en-US", {
    timeZone: tz,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const time = now.toLocaleTimeString("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `It is now ${date} (${tz}) at ${time}`;
}

export function getSystemPrompt(activeTools: string[]): string {
  const sections: string[] = [currentTimestamp(), IDENTITY, TOOL_GUIDE];

  for (const name of activeTools) {
    const prompt = TOOL_PROMPTS[name];
    if (prompt) {
      sections.push(prompt);
    }
  }

  sections.push(PATTERNS, SAFETY);

  return sections.join("\n\n");
}

// --- Project context discovery ---

const CONTEXT_FILENAMES = ["AGENTS.md", "CLAUDE.md"];
const MAX_CONTEXT_TOKENS = 4000;

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function isGitRoot(dir: string): Promise<boolean> {
  return fileExists(join(dir, ".git"));
}

interface ContextFile {
  path: string;
  content: string;
}

/**
 * Discovers project context files (AGENTS.md, CLAUDE.md) by walking up the
 * directory tree from `cwd` to the project root (.git) or filesystem root.
 *
 * Files are concatenated in root → cwd order (lowest → highest precedence).
 * Empty files are skipped. Total context is truncated to 4000 tokens by
 * removing the most distant files (lowest precedence) first.
 *
 * @param cwd - Starting directory for the walk-up search.
 * @returns Concatenated context string, or empty string if nothing found.
 */
export async function discoverProjectContext(cwd: string): Promise<string> {
  // Collect per-directory groups (cwd → root order)
  const dirGroups: ContextFile[][] = [];
  let current = resolve(cwd);

  // Walk up the directory tree collecting context files
  while (true) {
    const group: ContextFile[] = [];
    for (const filename of CONTEXT_FILENAMES) {
      const filePath = join(current, filename);
      if (await fileExists(filePath)) {
        try {
          const content = await readFile(filePath, "utf-8");
          if (content.trim().length > 0) {
            group.push({ path: filePath, content: content.trim() });
          }
        } catch {
          // Skip unreadable files
        }
      }
    }
    if (group.length > 0) {
      dirGroups.push(group);
    }

    // Stop if we've reached a .git root
    if (await isGitRoot(current)) break;

    // Move to parent directory
    const parent = dirname(current);
    // Stop at filesystem root (dirname returns same path)
    if (parent === current) break;
    current = parent;
  }

  if (dirGroups.length === 0) return "";

  // Reverse groups to get root → cwd order, then flatten
  // Within each group, AGENTS.md comes before CLAUDE.md (as collected)
  dirGroups.reverse();
  const collected = dirGroups.flat();

  // Apply token budget — remove most distant (first items = lowest precedence) if over budget
  let totalTokens = 0;
  const formatted: string[] = [];

  // Calculate total tokens for all files
  const entries = collected.map((file) => {
    const block = `--- project context: ${file.path} ---\n${file.content}`;
    return { block, tokens: countTokens(block) };
  });

  // Sum total tokens
  totalTokens = entries.reduce((sum, e) => sum + e.tokens, 0);

  if (totalTokens <= MAX_CONTEXT_TOKENS) {
    // Everything fits
    for (const entry of entries) {
      formatted.push(entry.block);
    }
  } else {
    // Truncate: remove from the beginning (most distant = lowest precedence)
    let remaining = totalTokens;
    let startIndex = 0;
    while (remaining > MAX_CONTEXT_TOKENS && startIndex < entries.length) {
      remaining -= entries[startIndex].tokens;
      startIndex++;
    }
    for (let i = startIndex; i < entries.length; i++) {
      formatted.push(entries[i].block);
    }
  }

  return formatted.join("\n\n");
}
