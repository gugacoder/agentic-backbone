// PreCompact hook — captures conversation context before Claude Code auto-compacts.
//
// Fires BEFORE auto-compaction so the memory system can absorb the full context
// instead of whatever the compaction leaves behind.
//
// The hook itself does NO API calls — only local file I/O for speed.

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
const MIN_TURNS_TO_FLUSH = 5;

function main() {
  const log = configureLogging(AGENT_ROOT, "pre-compact");

  let hookInput;
  try {
    hookInput = readHookStdin();
  } catch (e) {
    log.error(`Failed to parse stdin: ${e?.message || e}`);
    return;
  }

  const sessionId = hookInput.session_id || "unknown";
  const transcriptPathStr = hookInput.transcript_path || "";

  log.info(`PreCompact fired: session=${sessionId}`);

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
