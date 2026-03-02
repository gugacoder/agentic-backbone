import { tool } from "ai";
import { z } from "zod";
import fg from "fast-glob";
import { stat } from "node:fs/promises";

export const globTool = tool({
  description:
    "Fast file pattern matching. Supports glob patterns like '**/*.ts'. Returns matching file paths sorted by modification time.",
  inputSchema: z.object({
    pattern: z.string().describe("Glob pattern to match files against"),
    path: z
      .string()
      .optional()
      .describe("Directory to search in. Defaults to cwd."),
  }),
  execute: async ({ pattern, path }) => {
    try {
      const cwd = path ?? process.cwd();
      const files = await fg(pattern, {
        cwd,
        absolute: true,
        dot: false,
        onlyFiles: true,
      });

      // Sort by mtime (most recent first)
      const withStats = await Promise.all(
        files.map(async (f) => {
          try {
            const s = await stat(f);
            return { file: f, mtime: s.mtimeMs };
          } catch {
            return { file: f, mtime: 0 };
          }
        })
      );

      withStats.sort((a, b) => b.mtime - a.mtime);

      if (withStats.length === 0) return "No files matched the pattern.";
      return withStats.map((w) => w.file).join("\n");
    } catch (err: any) {
      return `Error: ${err.message}`;
    }
  },
});
