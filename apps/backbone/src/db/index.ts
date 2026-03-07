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

db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ts         TEXT NOT NULL DEFAULT (datetime('now')),
    type       TEXT NOT NULL,
    severity   TEXT NOT NULL,
    agent_id   TEXT,
    title      TEXT NOT NULL,
    body       TEXT,
    read       INTEGER NOT NULL DEFAULT 0,
    metadata   TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_notifications_ts ON notifications(ts DESC);
  CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
  CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint     TEXT NOT NULL UNIQUE,
    keys_p256dh  TEXT NOT NULL,
    keys_auth    TEXT NOT NULL,
    user_slug    TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS cost_daily (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    date        TEXT NOT NULL,
    agent_id    TEXT NOT NULL,
    operation   TEXT NOT NULL,
    tokens_in   INTEGER NOT NULL DEFAULT 0,
    tokens_out  INTEGER NOT NULL DEFAULT 0,
    cost_usd    REAL NOT NULL DEFAULT 0,
    calls       INTEGER NOT NULL DEFAULT 0,
    UNIQUE(date, agent_id, operation)
  );
  CREATE INDEX IF NOT EXISTS idx_cost_daily_date ON cost_daily(date);
  CREATE INDEX IF NOT EXISTS idx_cost_daily_agent ON cost_daily(agent_id);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS analytics_daily (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    date                TEXT NOT NULL,
    agent_id            TEXT NOT NULL,
    heartbeats_total    INTEGER NOT NULL DEFAULT 0,
    heartbeats_ok       INTEGER NOT NULL DEFAULT 0,
    heartbeats_error    INTEGER NOT NULL DEFAULT 0,
    heartbeats_skipped  INTEGER NOT NULL DEFAULT 0,
    conversations       INTEGER NOT NULL DEFAULT 0,
    messages_in         INTEGER NOT NULL DEFAULT 0,
    messages_out        INTEGER NOT NULL DEFAULT 0,
    cron_total          INTEGER NOT NULL DEFAULT 0,
    cron_ok             INTEGER NOT NULL DEFAULT 0,
    cron_error          INTEGER NOT NULL DEFAULT 0,
    response_ms_sum     REAL NOT NULL DEFAULT 0,
    response_ms_count   INTEGER NOT NULL DEFAULT 0,
    avg_response_ms     REAL,
    UNIQUE(date, agent_id)
  );
  CREATE INDEX IF NOT EXISTS idx_analytics_daily_date ON analytics_daily(date);
  CREATE INDEX IF NOT EXISTS idx_analytics_daily_agent ON analytics_daily(agent_id);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS budget_alerts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    scope       TEXT NOT NULL,
    threshold   REAL NOT NULL,
    period      TEXT NOT NULL,
    enabled     INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS knowledge_docs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id     TEXT NOT NULL,
    filename     TEXT NOT NULL,
    slug         TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size_bytes   INTEGER NOT NULL,
    chunks       INTEGER NOT NULL DEFAULT 0,
    status       TEXT NOT NULL DEFAULT 'processing',
    error        TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(agent_id, slug)
  );
  CREATE INDEX IF NOT EXISTS idx_knowledge_docs_agent ON knowledge_docs(agent_id);
`);

export { db };
