import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { db } from "../db/index.js";
import { agentDir } from "../context/paths.js";
import type { HeartbeatLogEntry } from "../heartbeat/log.js";
import type { CronRunLogEntry } from "../cron/log.js";
import type { Session } from "../conversations/index.js";

// --- Types ---

export interface TraceStep {
  index: number;
  type: "text" | "tool_call" | "tool_result";
  timestamp: string;
  durationMs: number;
  tokensIn?: number;
  tokensOut?: number;
  content?: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
}

export interface Trace {
  id: string;
  agentId: string;
  type: "heartbeat" | "conversation" | "cron";
  startedAt: string;
  durationMs: number;
  totalTokensIn: number;
  totalTokensOut: number;
  costUsd: number;
  steps: TraceStep[];
  model: string;
}

export type TraceType = "heartbeat" | "conversation" | "cron";

const MAX_TEXT_LENGTH = 500;

function truncate(text: string | null | undefined): string | undefined {
  if (!text) return undefined;
  return text.length > MAX_TEXT_LENGTH
    ? text.slice(0, MAX_TEXT_LENGTH) + "..."
    : text;
}

// --- Heartbeat ---

const selectHeartbeatById = db.prepare(
  `SELECT * FROM heartbeat_log WHERE id = ?`
);

function traceFromHeartbeat(id: string): Trace | null {
  const row = selectHeartbeatById.get(Number(id)) as HeartbeatLogEntry | undefined;
  if (!row) return null;

  const steps: TraceStep[] = [];

  if (row.preview || row.reason) {
    steps.push({
      index: 0,
      type: "text",
      timestamp: row.ts,
      durationMs: row.duration_ms ?? 0,
      tokensIn: row.input_tokens || undefined,
      tokensOut: row.output_tokens || undefined,
      content: truncate(row.preview ?? row.reason),
    });
  }

  return {
    id: String(row.id),
    agentId: row.agent_id,
    type: "heartbeat",
    startedAt: row.ts,
    durationMs: row.duration_ms ?? 0,
    totalTokensIn: row.input_tokens,
    totalTokensOut: row.output_tokens,
    costUsd: row.cost_usd,
    steps,
    model: "",
  };
}

// --- Conversation ---

const selectSessionById = db.prepare(
  `SELECT session_id, user_id, agent_id, channel_id, sdk_session_id, title, created_at, updated_at
   FROM sessions WHERE session_id = ?`
);

interface AiMessage {
  role: string;
  content: string | AiContentPart[];
}

interface AiContentPart {
  type: string;
  text?: string;
  toolCallId?: string;
  toolName?: string;
  args?: unknown;
  result?: unknown;
}

function loadAiSessionMessages(sdkSessionId: string): AiMessage[] {
  const sessionPath = join(process.cwd(), "data", "ai-sessions", `${sdkSessionId}.jsonl`);
  if (!existsSync(sessionPath)) return [];

  try {
    const content = readFileSync(sessionPath, "utf-8");
    return content
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as AiMessage);
  } catch {
    return [];
  }
}

function extractStepsFromAiMessages(messages: AiMessage[], startedAt: string): TraceStep[] {
  const steps: TraceStep[] = [];
  let index = 0;

  for (const msg of messages) {
    if (msg.role === "assistant") {
      if (typeof msg.content === "string") {
        if (msg.content.trim()) {
          steps.push({
            index: index++,
            type: "text",
            timestamp: startedAt,
            durationMs: 0,
            content: truncate(msg.content),
          });
        }
      } else if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === "text" && part.text?.trim()) {
            steps.push({
              index: index++,
              type: "text",
              timestamp: startedAt,
              durationMs: 0,
              content: truncate(part.text),
            });
          } else if (part.type === "tool-call") {
            steps.push({
              index: index++,
              type: "tool_call",
              timestamp: startedAt,
              durationMs: 0,
              toolName: part.toolName,
              toolInput: part.args,
            });
          }
        }
      }
    } else if (msg.role === "tool") {
      const parts = Array.isArray(msg.content) ? msg.content : [];
      for (const part of parts) {
        if (part.type === "tool-result") {
          steps.push({
            index: index++,
            type: "tool_result",
            timestamp: startedAt,
            durationMs: 0,
            toolName: part.toolName,
            toolOutput: part.result,
          });
        }
      }
    }
  }

  return steps;
}

interface PersistentMessage {
  ts: string;
  role: string;
  content: string;
}

function loadMessagesJsonl(agentId: string, sessionId: string): PersistentMessage[] {
  const jsonlPath = join(agentDir(agentId), "conversations", sessionId, "messages.jsonl");
  if (!existsSync(jsonlPath)) return [];

  try {
    return readFileSync(jsonlPath, "utf-8")
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as PersistentMessage);
  } catch {
    return [];
  }
}

function extractStepsFromPersistentMessages(messages: PersistentMessage[]): TraceStep[] {
  const steps: TraceStep[] = [];
  let index = 0;

  for (const msg of messages) {
    steps.push({
      index: index++,
      type: "text",
      timestamp: msg.ts,
      durationMs: 0,
      content: truncate(msg.content),
    });
  }

  return steps;
}

function traceFromConversation(sessionId: string): Trace | null {
  const session = selectSessionById.get(sessionId) as Session | undefined;
  if (!session) return null;

  let steps: TraceStep[];

  if (session.sdk_session_id) {
    const aiMessages = loadAiSessionMessages(session.sdk_session_id);
    steps = extractStepsFromAiMessages(aiMessages, session.created_at);
  } else {
    const messages = loadMessagesJsonl(session.agent_id, sessionId);
    steps = extractStepsFromPersistentMessages(messages);
  }

  return {
    id: sessionId,
    agentId: session.agent_id,
    type: "conversation",
    startedAt: session.created_at,
    durationMs: 0,
    totalTokensIn: 0,
    totalTokensOut: 0,
    costUsd: 0,
    steps,
    model: "",
  };
}

// --- Cron ---

const selectCronRunById = db.prepare(
  `SELECT * FROM cron_run_log WHERE id = ?`
);

function traceFromCron(id: string): Trace | null {
  const row = selectCronRunById.get(Number(id)) as CronRunLogEntry | undefined;
  if (!row) return null;

  const steps: TraceStep[] = [];

  if (row.summary || row.error) {
    steps.push({
      index: 0,
      type: "text",
      timestamp: row.ts,
      durationMs: row.duration_ms ?? 0,
      tokensIn: row.input_tokens || undefined,
      tokensOut: row.output_tokens || undefined,
      content: truncate(row.summary ?? row.error),
    });
  }

  return {
    id: String(row.id),
    agentId: row.agent_id,
    type: "cron",
    startedAt: row.ts,
    durationMs: row.duration_ms ?? 0,
    totalTokensIn: row.input_tokens,
    totalTokensOut: row.output_tokens,
    costUsd: row.cost_usd,
    steps,
    model: "",
  };
}

// --- Public API ---

export function getTrace(type: TraceType, id: string): Trace | null {
  switch (type) {
    case "heartbeat":
      return traceFromHeartbeat(id);
    case "conversation":
      return traceFromConversation(id);
    case "cron":
      return traceFromCron(id);
    default:
      return null;
  }
}
