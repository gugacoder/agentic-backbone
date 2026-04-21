// SessionStart hook - injects knowledge base context into every conversation.
//
// Reads HOME.md (the master catalog) and the recent daily log, then emits them
// as additional context so Claude always "remembers" what it has learned.

import fs from "node:fs";
import path from "node:path";

import { resolvePaths } from "./_common.js";

const { AGENT_ROOT } = resolvePaths(import.meta.url);
const NOTES_DIR = path.join(AGENT_ROOT, "kb", "calendar", "notes");
const HOME_FILE = path.join(AGENT_ROOT, "kb", "HOME.md");

const MAX_CONTEXT_CHARS = 20_000;
const MAX_LOG_LINES = 30;

function pad(n) {
  return String(n).padStart(2, "0");
}

function getRecentLog() {
  const today = new Date();
  for (let offset = 0; offset < 2; offset++) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const name = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.md`;
    const logPath = path.join(NOTES_DIR, name);
    if (fs.existsSync(logPath)) {
      const lines = fs.readFileSync(logPath, "utf-8").split("\n");
      const recent = lines.length > MAX_LOG_LINES ? lines.slice(-MAX_LOG_LINES) : lines;
      return recent.join("\n");
    }
  }
  return "(no recent daily log)";
}

function buildContext() {
  const parts = [];

  const today = new Date();
  const formatted = today.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  parts.push(`## Today\n${formatted}`);

  if (fs.existsSync(HOME_FILE)) {
    const indexContent = fs.readFileSync(HOME_FILE, "utf-8");
    parts.push(`## Knowledge Base Index\n\n${indexContent}`);
  } else {
    parts.push("## Knowledge Base Index\n\n(empty - no articles compiled yet)");
  }

  parts.push(`## Recent Daily Log\n\n${getRecentLog()}`);

  let context = parts.join("\n\n---\n\n");
  if (context.length > MAX_CONTEXT_CHARS) {
    context = context.slice(0, MAX_CONTEXT_CHARS) + "\n\n...(truncated)";
  }
  return context;
}

function main() {
  const output = {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: buildContext(),
    },
  };
  process.stdout.write(JSON.stringify(output));
}

main();
