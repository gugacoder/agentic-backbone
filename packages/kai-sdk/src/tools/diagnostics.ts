import { tool } from "ai";
import { z } from "zod";
import { exec } from "node:child_process";

const MAX_OUTPUT = 50_000;
const DEFAULT_COMMAND = "npx tsc --noEmit";
const DEFAULT_TIMEOUT = 120_000;

export const diagnosticsTool = tool({
  description:
    "Runs a type-checking or linting command and returns structured diagnostics. " +
    "Defaults to `npx tsc --noEmit`. Optionally filters errors to a specific file.",
  parameters: z.object({
    command: z
      .string()
      .optional()
      .describe(
        'The diagnostic command to run (default: "npx tsc --noEmit"). Examples: "npx eslint src/", "npx tsc --noEmit"'
      ),
    file_path: z
      .string()
      .optional()
      .describe(
        "Filter errors to this file path only. When set, only lines mentioning this path are returned."
      ),
  }),
  execute: async ({ command, file_path }) => {
    const cmd = command ?? DEFAULT_COMMAND;

    const raw = await new Promise<{ stdout: string; stderr: string; exitCode: number }>(
      (resolve) => {
        exec(
          cmd,
          { timeout: DEFAULT_TIMEOUT, maxBuffer: 10 * 1024 * 1024 },
          (err, stdout, stderr) => {
            resolve({
              stdout: stdout ?? "",
              stderr: stderr ?? "",
              exitCode: err ? (err as NodeJS.ErrnoException & { code?: number }).code ?? 1 : 0,
            });
          }
        );
      }
    );

    // Combine stdout + stderr (tsc writes to stdout, eslint to stdout, some tools to stderr)
    let combined = raw.stdout;
    if (raw.stderr) {
      combined += (combined ? "\n" : "") + raw.stderr;
    }

    // If the command succeeded with no output, report clean
    if (raw.exitCode === 0 && !combined.trim()) {
      return "Nenhum erro encontrado.";
    }

    // If there's output but exit code 0, it may be warnings — still return them
    let lines = combined.split("\n");

    // Filter to specific file if requested
    if (file_path) {
      // Normalize path separators for matching
      const normalized = file_path.replace(/\\/g, "/");
      lines = lines.filter((line) => {
        const normalizedLine = line.replace(/\\/g, "/");
        return normalizedLine.includes(normalized);
      });

      if (lines.length === 0) {
        return `Nenhum erro encontrado para ${file_path}.`;
      }
    }

    let output = lines.join("\n").trim();

    // If exit code 0 and we have output, it passed (possibly with warnings)
    if (raw.exitCode === 0 && !output) {
      return "Nenhum erro encontrado.";
    }

    if (!output) {
      return raw.exitCode === 0
        ? "Nenhum erro encontrado."
        : `Comando falhou com código ${raw.exitCode} mas sem saída de erros.`;
    }

    if (output.length > MAX_OUTPUT) {
      output = output.slice(0, MAX_OUTPUT) + "\n...[truncated]";
    }

    return output;
  },
});
