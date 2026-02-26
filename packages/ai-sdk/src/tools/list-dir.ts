import { tool } from "ai";
import { z } from "zod";
import { readdir, stat } from "node:fs/promises";
import { join, basename } from "node:path";

const DEFAULT_IGNORE = ["node_modules", ".git", "dist", "build"];

async function buildTree(
  dirPath: string,
  depth: number,
  maxDepth: number,
  ignore: string[],
  prefix: string
): Promise<string[]> {
  if (depth >= maxDepth) return [];

  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  // Filter ignored entries
  entries = entries.filter((e) => !ignore.includes(e.name));

  // Sort: directories first, then files, alphabetically within each group
  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  const lines: string[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const isLast = i === entries.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const childPrefix = isLast ? "    " : "│   ";

    if (entry.isDirectory()) {
      lines.push(`${prefix}${connector}${entry.name}/`);
      const children = await buildTree(
        join(dirPath, entry.name),
        depth + 1,
        maxDepth,
        ignore,
        prefix + childPrefix
      );
      lines.push(...children);
    } else {
      lines.push(`${prefix}${connector}${entry.name}`);
    }
  }

  return lines;
}

export const listDirTool = tool({
  description:
    "Lists files and directories as an indented tree. Use this to understand project structure.",
  parameters: z.object({
    path: z.string().describe("Absolute path of the directory to list"),
    depth: z
      .number()
      .optional()
      .default(3)
      .describe("Maximum depth to traverse (default: 3)"),
    ignore: z
      .array(z.string())
      .optional()
      .default(DEFAULT_IGNORE)
      .describe(
        "Directory/file names to ignore (default: node_modules, .git, dist, build)"
      ),
  }),
  execute: async ({ path, depth, ignore }) => {
    try {
      const s = await stat(path);
      if (!s.isDirectory()) {
        return `Error: ${path} is not a directory`;
      }

      const rootName = basename(path) || path;
      const lines = [`${rootName}/`];
      const children = await buildTree(path, 0, depth, ignore, "");
      lines.push(...children);

      const result = lines.join("\n");

      // Respect 50KB output limit
      if (result.length > 50_000) {
        return result.slice(0, 50_000) + "\n... (truncated at 50KB)";
      }

      return result;
    } catch (err: any) {
      return `Error: ${err.message}`;
    }
  },
});
