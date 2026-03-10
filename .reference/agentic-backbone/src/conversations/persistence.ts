import {
  existsSync,
  mkdirSync,
  writeFileSync,
  appendFileSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { agentDir } from "../context/paths.js";

export interface PersistentMessage {
  ts: string;
  role: "user" | "assistant" | "system";
  content: string;
}

// --- Paths ---

function sessionDir(agentId: string, sessionId: string): string {
  return join(agentDir(agentId), "conversations", sessionId);
}

// --- Session lifecycle ---

export function initSession(
  agentId: string,
  sessionId: string,
  userId: string
): void {
  const dir = sessionDir(agentId, sessionId);
  mkdirSync(dir, { recursive: true });

  const sessionMd = join(dir, "SESSION.md");
  if (!existsSync(sessionMd)) {
    const frontmatter = [
      "---",
      `session-id: ${sessionId}`,
      `user-id: ${userId}`,
      `agent-id: ${agentId}`,
      `created-at: ${new Date().toISOString()}`,
      `message-count: 0`,
      "---",
    ].join("\n");

    writeFileSync(sessionMd, `${frontmatter}\n\n# Session\n`);
  }
}

// --- Message persistence ---

export function appendMessage(
  agentId: string,
  sessionId: string,
  message: PersistentMessage
): void {
  const dir = sessionDir(agentId, sessionId);
  mkdirSync(dir, { recursive: true });

  const jsonlPath = join(dir, "messages.jsonl");
  const line = JSON.stringify(message) + "\n";
  appendFileSync(jsonlPath, line);
}

// --- Metadata updates ---

export function updateSessionMetadata(
  agentId: string,
  sessionId: string,
  updates: Record<string, string | number>
): void {
  const dir = sessionDir(agentId, sessionId);
  const sessionMd = join(dir, "SESSION.md");
  if (!existsSync(sessionMd)) return;

  let raw = readFileSync(sessionMd, "utf-8");
  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}:.*$`, "m");
    if (regex.test(raw)) {
      raw = raw.replace(regex, `${key}: ${value}`);
    }
  }
  writeFileSync(sessionMd, raw);
}

// --- Read messages ---

export function readMessages(
  agentId: string,
  sessionId: string
): PersistentMessage[] {
  const jsonlPath = join(sessionDir(agentId, sessionId), "messages.jsonl");
  if (!existsSync(jsonlPath)) return [];

  const lines = readFileSync(jsonlPath, "utf-8")
    .split("\n")
    .filter((l) => l.trim());

  return lines.map((line) => JSON.parse(line) as PersistentMessage);
}
