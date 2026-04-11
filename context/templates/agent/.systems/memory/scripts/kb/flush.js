// Memory flush agent — extracts important knowledge from a conversation context.
//
// Spawned by session-end.js or pre-compact.js as a background process.
// Reads a pre-extracted conversation context from a .md file, uses the Claude
// Agent SDK to decide what is worth saving, and appends the result to today's
// daily log.
//
// Usage:
//   node flush.js <context_file.md> <session_id>

// Recursion prevention: set BEFORE any import that might trigger Claude.
process.env.CLAUDE_INVOKED_BY = "memory_flush";

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

import {
  AGENT_ROOT,
  LAST_FLUSH_FILE,
  NOTES_DIR,
  SCRIPTS_DIR,
  STATE_FILE,
  systemLogPath,
} from "./config.js";
import { fileHash, loadPrompt } from "./utils.js";

const COMPILE_AFTER_HOUR = 18;

function appendLog(line) {
  const logPath = systemLogPath();
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  fs.appendFileSync(logPath, `${ts} INFO ${line}\n`, "utf-8");
}

function logError(line) {
  const logPath = systemLogPath();
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  fs.appendFileSync(logPath, `${ts} ERROR ${line}\n`, "utf-8");
}

function loadFlushState() {
  try {
    return JSON.parse(fs.readFileSync(LAST_FLUSH_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function saveFlushState(state) {
  fs.mkdirSync(path.dirname(LAST_FLUSH_FILE), { recursive: true });
  fs.writeFileSync(LAST_FLUSH_FILE, JSON.stringify(state), "utf-8");
}

function appendToDailyLog(content, section = "Session") {
  const today = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const dateStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const timeStr = `${pad(today.getHours())}:${pad(today.getMinutes())}`;

  const logPath = path.join(NOTES_DIR, `${dateStr}.md`);
  if (!fs.existsSync(logPath)) {
    fs.mkdirSync(NOTES_DIR, { recursive: true });
    fs.writeFileSync(
      logPath,
      `# Daily Log: ${dateStr}\n\n## Sessions\n\n## Memory Maintenance\n\n`,
      "utf-8",
    );
  }

  const entry = `### ${section} (${timeStr})\n\n${content}\n\n`;
  fs.appendFileSync(logPath, entry, "utf-8");
}

async function runFlush(context) {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  const prompt = loadPrompt("flush.md", { context });
  let response = "";

  try {
    for await (const message of query({
      prompt,
      options: {
        cwd: AGENT_ROOT,
        allowedTools: [],
        maxTurns: 2,
      },
    })) {
      if (message.type === "assistant") {
        const content = message.message?.content || [];
        for (const block of content) {
          if (block.type === "text") response += block.text;
        }
      }
    }
  } catch (e) {
    logError(`Agent SDK error: ${e?.stack || e}`);
    response = `FLUSH_ERROR: ${e?.name || "Error"}: ${e?.message || e}`;
  }

  return response;
}

function maybeTriggerCompilation() {
  const now = new Date();
  if (now.getHours() < COMPILE_AFTER_HOUR) return;

  const pad = (n) => String(n).padStart(2, "0");
  const todayLog = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.md`;

  let compileState = {};
  try {
    compileState = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  } catch {}

  const ingested = compileState.ingested || {};
  if (ingested[todayLog]) {
    const logPath = path.join(NOTES_DIR, todayLog);
    if (fs.existsSync(logPath) && ingested[todayLog].hash === fileHash(logPath)) {
      return; // log unchanged since last compile
    }
  }

  const compileScript = path.join(SCRIPTS_DIR, "compile.js");
  if (!fs.existsSync(compileScript)) return;

  appendLog(`End-of-day compilation triggered (after ${COMPILE_AFTER_HOUR}:00)`);

  try {
    const child = spawn("node", [compileScript], {
      cwd: AGENT_ROOT,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
  } catch (e) {
    logError(`Failed to spawn compile.js: ${e?.message || e}`);
  }
}

async function main() {
  if (process.argv.length < 4) {
    logError(`Usage: ${process.argv[1]} <context_file.md> <session_id>`);
    process.exit(1);
  }

  const contextFile = process.argv[2];
  const sessionId = process.argv[3];

  appendLog(`flush.js started for session ${sessionId}, context: ${contextFile}`);

  let context;
  try {
    context = fs.readFileSync(contextFile, "utf-8").trim();
  } catch {
    logError(`Context file not found: ${contextFile}`);
    return;
  }

  const state = loadFlushState();
  if (
    state.session_id === sessionId &&
    Date.now() / 1000 - (state.timestamp || 0) < 60
  ) {
    appendLog(`Skipping duplicate flush for session ${sessionId}`);
    return;
  }

  if (!context) {
    appendLog("Context file is empty, skipping");
    return;
  }

  appendLog(`Flushing session ${sessionId}: ${context.length} chars`);

  const response = await runFlush(context);

  if (response.includes("FLUSH_OK")) {
    appendLog("Result: FLUSH_OK");
    appendToDailyLog("FLUSH_OK - Nothing worth saving from this session", "Memory Flush");
  } else if (response.includes("FLUSH_ERROR")) {
    logError(`Result: ${response}`);
    appendToDailyLog(response, "Memory Flush");
  } else {
    appendLog(`Result: saved to daily log (${response.length} chars)`);
    appendToDailyLog(response, "Session");
  }

  saveFlushState({ session_id: sessionId, timestamp: Date.now() / 1000 });
  maybeTriggerCompilation();

  appendLog(`Flush complete for session ${sessionId}`);
}

main().catch((e) => {
  logError(`flush.js fatal: ${e?.stack || e}`);
  process.exit(1);
});
