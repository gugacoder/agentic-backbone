import {
  existsSync,
  mkdirSync,
  appendFileSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { agentDir } from "../context/paths.js";
import { readYaml, writeYaml } from "../context/readers.js";
import { SessionYmlSchema } from "../context/schemas.js";

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

  const sessionYml = join(dir, "SESSION.yml");
  if (!existsSync(sessionYml)) {
    const sessionData = SessionYmlSchema.parse({
      "session-id": sessionId,
      "user-id": userId,
      "agent-id": agentId,
      "created-at": new Date().toISOString(),
      "message-count": 0,
    });
    writeYaml(sessionYml, sessionData);
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
  const sessionYml = join(dir, "SESSION.yml");
  if (!existsSync(sessionYml)) return;

  const config = readYaml(sessionYml);
  for (const [key, value] of Object.entries(updates)) {
    config[key] = value;
  }
  writeYaml(sessionYml, config);
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

  return lines.reduce<PersistentMessage[]>((msgs, line, i) => {
    try {
      msgs.push(JSON.parse(line) as PersistentMessage);
    } catch {
      console.warn(`[persistence] skipping malformed line ${i + 1} in ${jsonlPath}`);
    }
    return msgs;
  }, []);
}
