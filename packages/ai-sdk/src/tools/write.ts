import { tool } from "ai";
import { z } from "zod";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export function createWriteTool(opts?: { autoApprove?: boolean }) {
  const baseTool = tool({
    description:
      "Writes content to a file. Creates parent directories if needed. Overwrites existing files.",
    parameters: z.object({
      file_path: z.string().describe("Absolute path to the file to write"),
      content: z.string().describe("The content to write to the file"),
    }),
    execute: async ({ file_path, content }) => {
      try {
        await mkdir(dirname(file_path), { recursive: true });
        await writeFile(file_path, content, "utf-8");
        return `File written successfully: ${file_path}`;
      } catch (err: any) {
        return `Error writing file: ${err.message}`;
      }
    },
  });

  if (opts?.autoApprove === false) {
    return Object.assign(baseTool, {
      needsApproval: async () => true as const,
    });
  }

  return baseTool;
}

export const writeTool = createWriteTool();
