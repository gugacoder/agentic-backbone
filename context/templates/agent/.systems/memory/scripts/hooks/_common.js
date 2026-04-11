// Shared helpers for the session-end, pre-compact, and session-start hooks.
// Uses only the Node standard library so hook startup stays light.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SLUG = "memory";

const HARNESS_NOISE_PREFIXES = [
  "<local-command-",
  "<command-name>",
  "<command-message>",
  "<command-args>",
  "<command-stdout>",
  "<command-stderr>",
];

export function resolvePaths(metaUrl) {
  const file = fileURLToPath(metaUrl);
  // <workspace>/.systems/memory/scripts/hooks/<file>.js
  const systemDir = path.resolve(path.dirname(file), "..", "..");   // .systems/memory/
  const agentRoot = path.resolve(systemDir, "..", "..");            // workspace/
  return { SYSTEM_DIR: systemDir, AGENT_ROOT: agentRoot };
}

export function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function systemDayDir(agentRoot, dateStr) {
  return path.join(agentRoot, "kb", "calendar", "system", dateStr || todayStr());
}

export function configureLogging(agentRoot, sourceLabel) {
  const dayDir = systemDayDir(agentRoot);
  fs.mkdirSync(dayDir, { recursive: true });
  const logPath = path.join(dayDir, `log-${SLUG}.md`);

  const write = (level, message) => {
    const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
    fs.appendFileSync(
      logPath,
      `${ts} ${level} [${sourceLabel}] ${message}\n`,
      "utf-8",
    );
  };

  return {
    info: (msg) => write("INFO", msg),
    error: (msg) => write("ERROR", msg),
    path: logPath,
  };
}

function isHarnessNoise(text) {
  const stripped = text.replace(/^\s+/, "");
  return HARNESS_NOISE_PREFIXES.some((p) => stripped.startsWith(p));
}

export function extractConversationContext(transcriptPath, maxTurns = 30, maxChars = 15_000) {
  const raw = fs.readFileSync(transcriptPath, "utf-8");
  const turns = [];

  for (const rawLine of raw.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    let role;
    let content;
    const msg = entry.message;
    if (msg && typeof msg === "object") {
      role = msg.role || "";
      content = msg.content ?? "";
    } else {
      role = entry.role || "";
      content = entry.content ?? "";
    }

    if (role !== "user" && role !== "assistant") continue;

    if (Array.isArray(content)) {
      const textParts = [];
      for (const block of content) {
        if (block && typeof block === "object" && block.type === "text") {
          textParts.push(block.text || "");
        } else if (typeof block === "string") {
          textParts.push(block);
        }
      }
      content = textParts.join("\n");
    }

    if (typeof content !== "string") continue;

    content = content.trim();
    if (!content || isHarnessNoise(content)) continue;

    const label = role === "user" ? "User" : "Assistant";
    turns.push(`**${label}:** ${content}\n`);
  }

  const recent = turns.slice(-maxTurns);
  let context = recent.join("\n");

  if (context.length > maxChars) {
    context = context.slice(context.length - maxChars);
    const boundary = context.indexOf("\n**");
    if (boundary > 0) context = context.slice(boundary + 1);
  }

  return { context, turnCount: recent.length };
}

export function readHookStdin() {
  // Claude Code on Windows may pass paths with unescaped backslashes,
  // which breaks JSON parsing; the fallback below doubles any lone
  // backslash so the JSON parse succeeds.
  const raw = fs.readFileSync(0, "utf-8");
  try {
    return JSON.parse(raw);
  } catch {
    const fixed = raw.replace(/(?<!\\)\\(?!["\\])/g, "\\\\");
    return JSON.parse(fixed);
  }
}
