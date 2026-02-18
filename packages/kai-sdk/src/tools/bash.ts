import { tool } from "ai";
import { z } from "zod";
import { exec } from "node:child_process";

const MAX_OUTPUT = 30_000;
const DEFAULT_TIMEOUT = 120_000;

export function createBashTool(opts?: { autoApprove?: boolean }) {
  const baseTool = tool({
    description:
      "Executes a bash command and returns stdout/stderr. Timeout defaults to 120s.",
    parameters: z.object({
      command: z.string().describe("The bash command to execute"),
      timeout: z
        .number()
        .optional()
        .describe("Timeout in milliseconds (max 600000)"),
    }),
    execute: async ({ command, timeout }) => {
      const ms = Math.min(timeout ?? DEFAULT_TIMEOUT, 600_000);

      return new Promise<string>((resolve) => {
        exec(command, { timeout: ms, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
          let output = "";

          if (stdout) output += stdout;
          if (stderr) output += (output ? "\n" : "") + stderr;
          if (err && !stdout && !stderr) {
            output = `Error: ${err.message}`;
          }

          if (output.length > MAX_OUTPUT) {
            output = output.slice(0, MAX_OUTPUT) + "\n...[truncated]";
          }

          resolve(output || "(no output)");
        });
      });
    },
  });

  if (opts?.autoApprove === false) {
    return Object.assign(baseTool, {
      needsApproval: async () => true as const,
    });
  }

  return baseTool;
}

export const bashTool = createBashTool();
