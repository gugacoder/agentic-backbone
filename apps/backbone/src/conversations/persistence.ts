import {
  existsSync,
  mkdirSync,
  appendFileSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { agentDir } from "../context/paths.js";
import { readYamlAs, writeYamlAs } from "../context/readers.js";
import { SessionYmlSchema } from "../context/schemas.js";
import type { ContentPart } from "./attachments.js";

export interface ModelMessageWithMeta {
  role: string;
  content: string | unknown[];
  _meta?: {
    id?: string;
    ts?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
  };
}

export function generateMessageId(): string {
  return `msg_${Date.now()}_${randomBytes(4).toString("hex")}`;
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
    const sessionData = {
      "session-id": sessionId,
      "user-id": userId,
      "agent-id": agentId,
      "created-at": new Date().toISOString(),
      "message-count": 0,
    };
    writeYamlAs(sessionYml, sessionData, SessionYmlSchema);
  }
}

// --- Persistence helpers ---

type StrippedImagePart = { type: "image"; _ref: string; mimeType?: string };
type StrippedFilePart = { type: "file"; _ref: string; mimeType: string };
type StoredPart = { type: "text"; text: string } | StrippedImagePart | StrippedFilePart;

/**
 * Replaces binary fields (image/data) with _ref references for JSONL storage.
 * Parts without _ref are kept unchanged.
 */
export function stripBase64ForStorage(content: ContentPart[]): StoredPart[] {
  return content.map((part) => {
    const p = part as unknown as Record<string, unknown>;

    if (part.type === "image" && typeof p["_ref"] === "string") {
      const stripped: StrippedImagePart = { type: "image", _ref: p["_ref"] };
      const mimeType = (part as { mimeType?: string }).mimeType;
      if (mimeType) stripped.mimeType = mimeType;
      return stripped;
    }

    if (part.type === "file" && typeof p["_ref"] === "string") {
      return {
        type: "file" as const,
        _ref: p["_ref"],
        mimeType: (part as { mimeType: string }).mimeType,
      };
    }

    return part as StoredPart;
  });
}

// --- Message persistence ---

export function appendModelMessage(
  agentId: string,
  sessionId: string,
  message: { role: string; content: string | ContentPart[]; _meta?: Record<string, unknown> }
): void {
  const dir = sessionDir(agentId, sessionId);
  mkdirSync(dir, { recursive: true });

  const storedContent = Array.isArray(message.content)
    ? stripBase64ForStorage(message.content)
    : message.content;

  const jsonlPath = join(dir, "messages.jsonl");
  const line = JSON.stringify({ ...message, content: storedContent }) + "\n";
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

  const config = readYamlAs(sessionYml, SessionYmlSchema) as Record<string, unknown>;
  for (const [key, value] of Object.entries(updates)) {
    config[key] = value;
  }
  writeYamlAs(sessionYml, config, SessionYmlSchema);
}

// --- Read messages ---

export function readMessages(
  agentId: string,
  sessionId: string
): ModelMessageWithMeta[] {
  const jsonlPath = join(sessionDir(agentId, sessionId), "messages.jsonl");
  if (!existsSync(jsonlPath)) return [];

  const lines = readFileSync(jsonlPath, "utf-8")
    .split("\n")
    .filter((l) => l.trim());

  return lines.reduce<ModelMessageWithMeta[]>((msgs, line, i) => {
    try {
      msgs.push(JSON.parse(line) as ModelMessageWithMeta);
    } catch {
      console.warn(`[persistence] skipping malformed line ${i + 1} in ${jsonlPath}`);
    }
    return msgs;
  }, []);
}
