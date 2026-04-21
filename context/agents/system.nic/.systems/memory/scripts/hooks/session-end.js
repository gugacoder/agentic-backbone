// SessionEnd hook — captures the conversation transcript for memory extraction.
//
// Reads the transcript path from stdin, extracts conversation context, and spawns
// flush.js as a background process to absorb it into the daily log.
//
// The hook itself does NO API calls — only local file I/O for speed.

// Recursion guard: if we were spawned by flush.js (which runs Claude Code, which
// would fire this hook again), exit immediately.
if (process.env.CLAUDE_INVOKED_BY) process.exit(0);

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

import {
  SLUG,
  configureLogging,
  extractConversationContext,
  readHookStdin,
  resolvePaths,
  systemDayDir,
} from "./_common.js";

const { SYSTEM_DIR, AGENT_ROOT } = resolvePaths(import.meta.url);
const MIN_TURNS_TO_FLUSH = 1;

function main() {
  const log = configureLogging(AGENT_ROOT, "hook");

  let hookInput;
  try {
    hookInput = readHookStdin();
  } catch (e) {
    log.error(`Failed to parse stdin: ${e?.message || e}`);
    return;
  }

  const sessionId = hookInput.session_id || "unknown";
  const source = hookInput.source || "unknown";
  const transcriptPathStr = hookInput.transcript_path || "";

  log.info(`SessionEnd fired: session=${sessionId} source=${source}`);

  if (!transcriptPathStr || typeof transcriptPathStr !== "string") {
    log.info("SKIP: no transcript path");
    return;
  }

  let context;
  let turnCount;
  try {
    const res = extractConversationContext(transcriptPathStr);
    context = res.context;
    turnCount = res.turnCount;
  } catch (e) {
    if (e?.code === "ENOENT") {
      log.info(`SKIP: transcript missing: ${transcriptPathStr}`);
      return;
    }
    log.error(`Context extraction failed: ${e?.message || e}`);
    return;
  }

  if (!context.trim()) {
    log.info("SKIP: empty context");
    return;
  }

  if (turnCount < MIN_TURNS_TO_FLUSH) {
    log.info(`SKIP: only ${turnCount} turns (min ${MIN_TURNS_TO_FLUSH})`);
    return;
  }

  const dayDir = systemDayDir(AGENT_ROOT);
  fs.mkdirSync(dayDir, { recursive: true });
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const timestamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const contextFile = path.join(dayDir, `session-flush-${SLUG}-${sessionId}-${timestamp}.md`);
  fs.writeFileSync(contextFile, context, "utf-8");

  const flushScript = path.join(SYSTEM_DIR, "scripts", "kb", "flush.js");

  try {
    const child = spawn("node", [flushScript, contextFile, sessionId], {
      stdio: "ignore",
      detached: true,
      windowsHide: true,
    });
    child.unref();
    log.info(
      `Spawned flush.js for session ${sessionId} (${turnCount} turns, ${context.length} chars)`,
    );
  } catch (e) {
    log.error(`Failed to spawn flush.js: ${e?.message || e}`);
  }
}

main();
