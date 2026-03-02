# Tool Usage

## Core Rules

- **Always read before editing.** Use the Read tool to see current content before any Edit or Write.
- **Prefer dedicated tools over Bash.** Use Read instead of `cat`, Grep instead of `grep`, Glob instead of `find`. Reserve Bash for git, npm, build, and system commands.
- **Verify after modifying.** After editing a file, read it back or run a build/test to confirm correctness.
- **Never repeat a failed action identically.** If a tool call fails, change your approach — different parameters, different tool, or investigate the error first.
- **Parallelize when possible.** If multiple tool calls are independent, make them together instead of sequentially.
