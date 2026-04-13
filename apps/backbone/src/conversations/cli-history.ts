/**
 * Reads conversation history from the CLI's JSONL storage.
 *
 * Path: {CLAUDE_CONFIG_DIR}/projects/{sanitizedCwd}/{sessionId}.jsonl
 *
 * The CLI writes SDKMessage entries as JSONL. We read, filter, and paginate.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { agentClaudeConfigDir, agentDir } from "../context/paths.js";

// --- Sanitize (mirrors openclaude-sdk / Claude CLI) ---

const SANITIZE_RE = /[^a-zA-Z0-9]/g;
const MAX_SANITIZED_LENGTH = 200;

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  let n = Math.abs(h);
  if (n === 0) return "0";
  let out = "";
  while (n > 0) {
    out = "0123456789abcdefghijklmnopqrstuvwxyz"[n % 36] + out;
    n = Math.floor(n / 36);
  }
  return out;
}

function sanitizePath(name: string): string {
  const sanitized = name.replace(SANITIZE_RE, "-");
  if (sanitized.length > MAX_SANITIZED_LENGTH) {
    return sanitized.slice(0, MAX_SANITIZED_LENGTH) + "-" + simpleHash(name);
  }
  return sanitized;
}

// --- JSONL search ---

/**
 * Finds the JSONL file for a session. Searches:
 * 1. {configDir}/projects/{sanitizedAgentDir}/{sessionId}.jsonl
 * 2. Any subdirectory under {configDir}/projects/ containing {sessionId}.jsonl
 */
function findSessionJsonl(agentId: string, sessionId: string): string | null {
  const configDir = agentClaudeConfigDir(agentId);
  const projectsDir = join(configDir, "projects");
  if (!existsSync(projectsDir)) return null;

  // Try the expected path first (sanitized agent cwd)
  const cwd = agentDir(agentId);
  const sanitizedCwd = sanitizePath(resolve(cwd));
  const expectedPath = join(projectsDir, sanitizedCwd, `${sessionId}.jsonl`);
  if (existsSync(expectedPath)) return expectedPath;

  // Fallback: search all subdirectories
  try {
    const entries = readdirSync(projectsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const candidate = join(projectsDir, entry.name, `${sessionId}.jsonl`);
      if (existsSync(candidate)) return candidate;
    }
  } catch {
    // ignore
  }

  return null;
}

// --- Message types ---

interface CliMessage {
  type: string;
  uuid?: string;
  session_id?: string;
  [key: string]: unknown;
}

export interface PaginatedMessages {
  messages: CliMessage[];
  hasMore: boolean;
  cursor: string | null;
}

// --- Legacy conversion ---

interface LegacyMessage {
  role: string;
  content: string;
  _meta?: { id?: string; ts?: string };
}

function isLegacy(msg: unknown): msg is LegacyMessage {
  const m = msg as Record<string, unknown>;
  return typeof m.role === "string" && !("type" in m);
}

function convertLegacy(msg: LegacyMessage, sessionId: string): CliMessage {
  const id = msg._meta?.id ?? `legacy_${Date.now()}`;
  if (msg.role === "assistant") {
    return {
      type: "assistant",
      uuid: id,
      session_id: sessionId,
      message: {
        id,
        content: [{ type: "text", text: msg.content }],
      },
      parent_tool_use_id: null,
    };
  }
  return {
    type: "user",
    uuid: id,
    session_id: sessionId,
    message: {
      content: typeof msg.content === "string"
        ? [{ type: "text", text: msg.content }]
        : msg.content,
    },
    parent_tool_use_id: null,
  };
}

// --- Read & filter ---

function readAllMessages(agentId: string, sessionId: string): CliMessage[] {
  // Try CLI JSONL first
  const jsonlPath = findSessionJsonl(agentId, sessionId);

  if (jsonlPath) {
    return parseJsonl(jsonlPath, sessionId);
  }

  // Fallback to legacy backbone JSONL
  const legacyPath = join(agentDir(agentId), "conversations", sessionId, "messages.jsonl");
  if (existsSync(legacyPath)) {
    return parseJsonl(legacyPath, sessionId);
  }

  return [];
}

function parseJsonl(path: string, sessionId: string): CliMessage[] {
  const content = readFileSync(path, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  const messages: CliMessage[] = [];

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (isLegacy(parsed)) {
        messages.push(convertLegacy(parsed, sessionId));
      } else if (parsed.type) {
        messages.push(parsed as CliMessage);
      }
    } catch {
      // skip malformed lines
    }
  }

  return messages;
}

/**
 * Returns only user and assistant messages (filtered).
 * Other types (queue-operation, attachment, last-prompt, result, system) are excluded.
 */
function filterDisplayMessages(messages: CliMessage[]): CliMessage[] {
  return messages.filter((m) => m.type === "user" || m.type === "assistant");
}

// --- Paginated read ---

/**
 * Reads messages with cursor-based reverse pagination.
 *
 * @param agentId - Agent ID
 * @param sessionId - Session/conversation ID
 * @param limit - Max messages to return (default: 50, max: 200)
 * @param before - Cursor (message uuid). Returns messages before this point.
 */
export function readMessagesPaginated(
  agentId: string,
  sessionId: string,
  limit = 50,
  before?: string
): PaginatedMessages {
  const clampedLimit = Math.min(Math.max(1, limit), 200);
  const all = filterDisplayMessages(readAllMessages(agentId, sessionId));

  if (all.length === 0) {
    return { messages: [], hasMore: false, cursor: null };
  }

  let endIndex = all.length;

  if (before) {
    // Find the index of the cursor message
    const cursorIndex = all.findIndex((m) => m.uuid === before);
    if (cursorIndex >= 0) {
      endIndex = cursorIndex;
    }
    // If cursor not found, return from the end (graceful degradation)
  }

  const startIndex = Math.max(0, endIndex - clampedLimit);
  const slice = all.slice(startIndex, endIndex);
  const hasMore = startIndex > 0;
  const cursor = hasMore && slice.length > 0 ? (slice[0]!.uuid ?? null) : null;

  return {
    messages: slice,
    hasMore,
    cursor,
  };
}
