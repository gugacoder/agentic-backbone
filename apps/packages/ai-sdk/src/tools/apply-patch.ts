import { tool } from "ai";
import { z } from "zod";
import { readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

interface PatchOperation {
  type: "add" | "update" | "delete";
  path: string;
  lines: string[];
}

function parsePatch(patch: string): PatchOperation[] {
  const lines = patch.split("\n");
  const operations: PatchOperation[] = [];
  let current: PatchOperation | null = null;
  let started = false;

  for (const line of lines) {
    if (line.trim() === "*** Begin Patch") {
      started = true;
      continue;
    }

    if (line.trim() === "*** End Patch") {
      if (current) operations.push(current);
      break;
    }

    if (!started) continue;

    if (line.startsWith("*** Add File: ")) {
      if (current) operations.push(current);
      current = { type: "add", path: line.slice("*** Add File: ".length).trim(), lines: [] };
      continue;
    }

    if (line.startsWith("*** Update File: ")) {
      if (current) operations.push(current);
      current = { type: "update", path: line.slice("*** Update File: ".length).trim(), lines: [] };
      continue;
    }

    if (line.startsWith("*** Delete File: ")) {
      if (current) operations.push(current);
      current = { type: "delete", path: line.slice("*** Delete File: ".length).trim(), lines: [] };
      continue;
    }

    if (current) {
      current.lines.push(line);
    }
  }

  // Handle case where End Patch is missing but we have a pending operation
  if (current && !operations.includes(current)) {
    operations.push(current);
  }

  return operations;
}

function applyUpdate(original: string, patchLines: string[]): string {
  const originalLines = original.split("\n");
  const result: string[] = [];
  let originalIdx = 0;

  let i = 0;
  while (i < patchLines.length) {
    const line = patchLines[i];

    if (line.startsWith("@@")) {
      // Context marker — find the context line in the original to sync position
      const contextText = line.slice(3); // skip "@@ "
      // Advance in original until we find a line matching the context
      while (originalIdx < originalLines.length) {
        if (originalLines[originalIdx] === contextText) {
          break;
        }
        result.push(originalLines[originalIdx]);
        originalIdx++;
      }
      // Push the context line itself
      if (originalIdx < originalLines.length) {
        result.push(originalLines[originalIdx]);
        originalIdx++;
      }
      i++;
      continue;
    }

    if (line.startsWith("-")) {
      // Remove line — skip it in original
      originalIdx++;
      i++;
      continue;
    }

    if (line.startsWith("+")) {
      // Add line
      result.push(line.slice(1));
      i++;
      continue;
    }

    // Unrecognized line in patch — treat as context (copy from original)
    if (line.startsWith(" ")) {
      result.push(originalLines[originalIdx] ?? line.slice(1));
      originalIdx++;
    }
    i++;
  }

  // Copy remaining original lines
  while (originalIdx < originalLines.length) {
    result.push(originalLines[originalIdx]);
    originalIdx++;
  }

  return result.join("\n");
}

export function createApplyPatchTool(opts?: { autoApprove?: boolean }) {
  const baseTool = tool({
    description:
      "Applies a multi-file patch in envelope format (Begin Patch / End Patch). Supports Add File (create new), Update File (apply diff with @@ context and +/- lines), and Delete File operations.",
    inputSchema: z.object({
      patch: z
        .string()
        .describe(
          'The patch text in envelope format: "*** Begin Patch" / "*** End Patch" with "*** Add File: path", "*** Update File: path", "*** Delete File: path" sections'
        ),
    }),
    execute: async ({ patch }) => {
      try {
        const operations = parsePatch(patch);

        if (operations.length === 0) {
          return "Error: no valid operations found in patch. Ensure the patch uses the *** Begin Patch / *** End Patch envelope format.";
        }

        const results: string[] = [];

        for (const op of operations) {
          switch (op.type) {
            case "add": {
              const content = op.lines
                .filter((l) => l.startsWith("+"))
                .map((l) => l.slice(1))
                .join("\n");
              await mkdir(dirname(op.path), { recursive: true });
              await writeFile(op.path, content, "utf-8");
              results.push(`Added: ${op.path}`);
              break;
            }

            case "update": {
              const original = await readFile(op.path, "utf-8");
              const updated = applyUpdate(original, op.lines);
              await writeFile(op.path, updated, "utf-8");
              results.push(`Updated: ${op.path}`);
              break;
            }

            case "delete": {
              await unlink(op.path);
              results.push(`Deleted: ${op.path}`);
              break;
            }
          }
        }

        return `Patch applied successfully:\n${results.join("\n")}`;
      } catch (err: any) {
        return `Error applying patch: ${err.message}`;
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

export const applyPatchTool = createApplyPatchTool();
