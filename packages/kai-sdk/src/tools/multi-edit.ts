import { tool } from "ai";
import { z } from "zod";
import { readFile, writeFile } from "node:fs/promises";

export const multiEditTool = tool({
  description:
    "Applies multiple string replacements to a single file atomically. If any edit fails (old_string not found), none are applied.",
  parameters: z.object({
    file_path: z.string().describe("Absolute path to the file to edit"),
    edits: z
      .array(
        z.object({
          old_string: z.string().describe("The exact text to find"),
          new_string: z.string().describe("The replacement text"),
          replace_all: z
            .boolean()
            .optional()
            .default(false)
            .describe("Replace all occurrences instead of just the first"),
        })
      )
      .min(1)
      .describe("Array of edits to apply sequentially"),
  }),
  execute: async ({ file_path, edits }) => {
    try {
      let content = await readFile(file_path, "utf-8");

      // Validation pass: check all old_strings exist before applying any edit
      for (let i = 0; i < edits.length; i++) {
        const edit = edits[i];
        if (!content.includes(edit.old_string)) {
          return `Error: edit[${i}] old_string not found in ${file_path}. No edits applied (atomic rollback).`;
        }
        if (!edit.replace_all) {
          const count = content.split(edit.old_string).length - 1;
          if (count > 1) {
            return `Error: edit[${i}] old_string appears ${count} times. Provide more context or set replace_all to true. No edits applied.`;
          }
        }
        // Apply the edit to the working content so subsequent edits see the result
        content = edit.replace_all
          ? content.replaceAll(edit.old_string, edit.new_string)
          : content.replace(edit.old_string, edit.new_string);
      }

      await writeFile(file_path, content, "utf-8");
      return `${edits.length} edit(s) applied successfully to ${file_path}`;
    } catch (err: any) {
      return `Error editing file: ${err.message}`;
    }
  },
});
