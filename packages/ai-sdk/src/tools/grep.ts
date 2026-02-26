import { tool } from "ai";
import { z } from "zod";
import { execFile } from "node:child_process";

const MAX_OUTPUT = 30_000;

export const grepTool = tool({
  description:
    "Searches file contents using ripgrep (rg) with regex support. Falls back to grep if rg is unavailable.",
  parameters: z.object({
    pattern: z.string().describe("Regex pattern to search for"),
    path: z
      .string()
      .optional()
      .describe("File or directory to search in. Defaults to cwd."),
    glob: z
      .string()
      .optional()
      .describe("Glob pattern to filter files (e.g. '*.ts')"),
    output_mode: z
      .enum(["content", "files_with_matches", "count"])
      .optional()
      .default("files_with_matches")
      .describe("Output mode"),
  }),
  execute: async ({ pattern, path, glob: globFilter, output_mode }) => {
    const searchPath = path ?? ".";

    // Build rg args array (no shell quoting needed with execFile)
    const args: string[] = [];

    if (output_mode === "files_with_matches") args.push("-l");
    else if (output_mode === "count") args.push("-c");
    else args.push("-n"); // content mode: show line numbers

    if (globFilter) args.push("--glob", globFilter);

    args.push(pattern, searchPath);

    return new Promise<string>((resolve) => {
      execFile("rg", args, { timeout: 30_000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
        if (stdout) {
          const output = stdout.length > MAX_OUTPUT
            ? stdout.slice(0, MAX_OUTPUT) + "\n...[truncated]"
            : stdout;
          resolve(output.trim());
        } else if (err) {
          // rg returns exit code 1 for no matches
          if ((err as any).code === 1) {
            resolve("No matches found.");
          } else {
            // Try grep fallback
            const grepArgs = ["-rn"];
            if (globFilter) grepArgs.push(`--include=${globFilter}`);
            grepArgs.push(pattern, searchPath);

            execFile("grep", grepArgs, { timeout: 30_000 }, (gErr, gOut) => {
              if (gOut) resolve(gOut.trim());
              else resolve("No matches found.");
            });
          }
        } else {
          resolve("No matches found.");
        }
      });
    });
  },
});
