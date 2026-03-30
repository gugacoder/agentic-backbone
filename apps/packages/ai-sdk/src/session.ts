import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { ModelMessage } from "ai";

function sessionPath(dir: string): string {
  return join(dir, "messages.jsonl");
}

export async function loadSession(dir: string): Promise<ModelMessage[]> {
  try {
    const content = await readFile(sessionPath(dir), "utf-8");
    return content
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const { _meta, ...msg } = JSON.parse(line);
        return msg as ModelMessage;
      });
  } catch {
    return [];
  }
}

export async function saveSession(
  dir: string,
  messages: (ModelMessage & { _meta?: Record<string, unknown> })[]
): Promise<void> {
  const filePath = sessionPath(dir);
  await mkdir(dirname(filePath), { recursive: true });
  const ts = new Date().toISOString();
  const jsonl =
    messages
      .map((m) => {
        if (!(m as any)._meta) {
          return JSON.stringify({ ...m, _meta: { ts } });
        }
        return JSON.stringify(m);
      })
      .join("\n") + "\n";
  await writeFile(filePath, jsonl, "utf-8");
}
