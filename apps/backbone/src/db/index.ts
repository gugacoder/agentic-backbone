import Database, { type Database as DatabaseType } from "better-sqlite3";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

const DATA_DIR = join(process.cwd(), "data");
mkdirSync(DATA_DIR, { recursive: true });

const db: DatabaseType = new Database(join(DATA_DIR, "backbone.sqlite"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    session_id    TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL,
    sdk_session_id TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Idempotent migration: add title column
try { db.exec(`ALTER TABLE sessions ADD COLUMN title TEXT DEFAULT NULL`); } catch {}

// Idempotent migration: add agent_id column
try { db.exec(`ALTER TABLE sessions ADD COLUMN agent_id TEXT DEFAULT 'system.main'`); } catch {}

// Idempotent migration: add channel_id column
try { db.exec(`ALTER TABLE sessions ADD COLUMN channel_id TEXT DEFAULT NULL`); } catch {}

db.exec(`
  CREATE TABLE IF NOT EXISTS heartbeat_log (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id               TEXT    NOT NULL,
    ts                     TEXT    NOT NULL DEFAULT (datetime('now')),
    status                 TEXT    NOT NULL,
    duration_ms            INTEGER,
    input_tokens           INTEGER DEFAULT 0,
    output_tokens          INTEGER DEFAULT 0,
    cache_read_tokens      INTEGER DEFAULT 0,
    cache_creation_tokens  INTEGER DEFAULT 0,
    cost_usd               REAL    DEFAULT 0,
    num_turns              INTEGER DEFAULT 0,
    stop_reason            TEXT,
    reason                 TEXT,
    preview                TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_heartbeat_log_agent_ts
    ON heartbeat_log (agent_id, ts DESC);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS cron_run_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    job_slug      TEXT NOT NULL,
    agent_id      TEXT NOT NULL,
    ts            TEXT NOT NULL DEFAULT (datetime('now')),
    status        TEXT NOT NULL,
    duration_ms   INTEGER,
    error         TEXT,
    summary       TEXT,
    input_tokens  INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cost_usd      REAL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_cron_run_log_job_ts
    ON cron_run_log (job_slug, ts DESC);
`);

export { db };
