import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { CoreMessage } from "ai";

function sessionPath(dir: string, sessionId: string): string {
  return join(dir, `${sessionId}.jsonl`);
}

export async function loadSession(
  dir: string,
  sessionId: string
): Promise<CoreMessage[]> {
  try {
    const content = await readFile(sessionPath(dir, sessionId), "utf-8");
    return content
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as CoreMessage);
  } catch {
    return [];
  }
}

export async function saveSession(
  dir: string,
  sessionId: string,
  messages: CoreMessage[]
): Promise<void> {
  const filePath = sessionPath(dir, sessionId);
  await mkdir(dirname(filePath), { recursive: true });
  const jsonl = messages.map((m) => JSON.stringify(m)).join("\n") + "\n";
  await writeFile(filePath, jsonl, "utf-8");
}
