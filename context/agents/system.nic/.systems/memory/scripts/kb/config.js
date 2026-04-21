import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// <workspace>/.systems/memory/scripts/kb/config.js
// parents: kb -> scripts -> memory -> .systems -> workspace
export const SYSTEM_DIR = path.resolve(__dirname, "..", "..");           // .systems/memory/
export const AGENT_ROOT = path.resolve(SYSTEM_DIR, "..", "..");          // workspace/

export const PROMPTS_DIR = path.join(SYSTEM_DIR, "prompts");
export const SCRIPTS_DIR = path.join(SYSTEM_DIR, "scripts", "kb");
export const HOOKS_DIR = path.join(SYSTEM_DIR, "scripts", "hooks");

export const KB_DIR = path.join(AGENT_ROOT, "kb");
export const ATLAS_DIR = path.join(KB_DIR, "atlas");
export const CALENDAR_DIR = path.join(KB_DIR, "calendar");
export const EFFORT_DIR = path.join(KB_DIR, "effort");
export const INBOX_DIR = path.join(KB_DIR, "+");
export const X_FILES_DIR = path.join(KB_DIR, "x", "files");

export const CONCEPTS_DIR = path.join(ATLAS_DIR, "concepts");
export const CONNECTIONS_DIR = path.join(ATLAS_DIR, "connections");
export const MAPS_DIR = path.join(ATLAS_DIR, "maps");
export const QA_DIR = path.join(ATLAS_DIR, "qa");
export const WORKS_DIR = path.join(ATLAS_DIR, "works");

export const NOTES_DIR = path.join(CALENDAR_DIR, "notes");
export const EVENTS_DIR = path.join(CALENDAR_DIR, "events");
export const CALENDAR_SYSTEM_DIR = path.join(CALENDAR_DIR, "system");

export const EFFORT_ON_DIR = path.join(EFFORT_DIR, "on");
export const EFFORT_SIMMERING_DIR = path.join(EFFORT_DIR, "simmering");
export const EFFORT_OFF_DIR = path.join(EFFORT_DIR, "off");

export const HOME_FILE = path.join(KB_DIR, "HOME.md");
export const LOG_FILE = path.join(CALENDAR_SYSTEM_DIR, "log.md");

export const SLUG = "memory";
export const X_DIR = path.join(KB_DIR, "x", SLUG);
export const MAP_MEMORY_MD = path.join(MAPS_DIR, `${SLUG}.md`);

export const STATE_FILE = path.join(X_DIR, "state.json");
export const LAST_FLUSH_FILE = path.join(X_DIR, "last-flush.json");

export const TIMEZONE = "America/Sao_Paulo";

export function nowIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const tzOffsetMin = -d.getTimezoneOffset();
  const sign = tzOffsetMin >= 0 ? "+" : "-";
  const absMin = Math.abs(tzOffsetMin);
  const tz = `${sign}${pad(Math.floor(absMin / 60))}:${pad(absMin % 60)}`;
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${tz}`
  );
}

export function todayIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function systemDayDir(dateStr) {
  return path.join(CALENDAR_SYSTEM_DIR, dateStr || todayIso());
}

export function systemLogPath(dateStr) {
  return path.join(systemDayDir(dateStr), `log-${SLUG}.md`);
}

export function sessionFlushPath(sessionId, timestamp, dateStr) {
  return path.join(
    systemDayDir(dateStr),
    `session-flush-${SLUG}-${sessionId}-${timestamp}.md`,
  );
}

export function lintReportPath(dateStr) {
  return path.join(systemDayDir(dateStr), "lint.md");
}
