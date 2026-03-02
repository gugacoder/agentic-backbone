import { tool } from "ai";
import { z } from "zod";
import { readFile } from "node:fs/promises";

export const readTool = tool({
  description:
    "Reads a file from the local filesystem. Returns content with line numbers (cat -n format).",
  inputSchema: z.object({
    file_path: z.string().describe("Absolute path to the file to read"),
    offset: z
      .number()
      .optional()
      .describe("Line number to start reading from (1-based)"),
    limit: z
      .number()
      .optional()
      .describe("Maximum number of lines to read"),
  }),
  execute: async ({ file_path, offset, limit }) => {
    try {
      const content = await readFile(file_path, "utf-8");
      let lines = content.split("\n");

      const start = offset ? offset - 1 : 0;
      const end = limit ? start + limit : lines.length;
      lines = lines.slice(start, end);

      const maxLineNum = start + lines.length;
      const pad = String(maxLineNum).length;

      const numbered = lines.map(
        (line, i) =>
          `${String(start + i + 1).padStart(pad)}\t${line}`
      );
      return numbered.join("\n");
    } catch (err: any) {
      return `Error reading file: ${err.message}`;
    }
  },
});
