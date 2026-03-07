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

// Idempotent migration: add takeover columns
try { db.exec(`ALTER TABLE sessions ADD COLUMN takeover_by TEXT DEFAULT NULL`); } catch {}
try { db.exec(`ALTER TABLE sessions ADD COLUMN takeover_at TEXT DEFAULT NULL`); } catch {}

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

db.exec(`
  CREATE TABLE IF NOT EXISTS eval_sets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id    TEXT NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_eval_sets_agent ON eval_sets(agent_id);

  CREATE TABLE IF NOT EXISTS eval_cases (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    set_id      INTEGER NOT NULL REFERENCES eval_sets(id) ON DELETE CASCADE,
    input       TEXT NOT NULL,
    expected    TEXT NOT NULL,
    tags        TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_eval_cases_set ON eval_cases(set_id);

  CREATE TABLE IF NOT EXISTS eval_runs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    set_id      INTEGER NOT NULL REFERENCES eval_sets(id) ON DELETE CASCADE,
    agent_id    TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    score_avg   REAL,
    total_cases INTEGER NOT NULL DEFAULT 0,
    passed      INTEGER NOT NULL DEFAULT 0,
    failed      INTEGER NOT NULL DEFAULT 0,
    started_at  TEXT,
    finished_at TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_eval_runs_agent ON eval_runs(agent_id);
  CREATE INDEX IF NOT EXISTS idx_eval_runs_set ON eval_runs(set_id);

  CREATE TABLE IF NOT EXISTS eval_results (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id      INTEGER NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
    case_id     INTEGER NOT NULL REFERENCES eval_cases(id),
    actual      TEXT NOT NULL,
    score       REAL NOT NULL,
    reasoning   TEXT,
    passed      INTEGER NOT NULL DEFAULT 0,
    latency_ms  INTEGER,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_eval_results_run ON eval_results(run_id);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS approval_requests (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id     TEXT NOT NULL,
    session_id   TEXT,
    tool_name    TEXT NOT NULL,
    action_label TEXT NOT NULL,
    payload      TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending',
    decided_by   TEXT,
    decided_at   TEXT,
    expires_at   TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_approval_agent ON approval_requests(agent_id, status);
  CREATE INDEX IF NOT EXISTS idx_approval_session ON approval_requests(session_id);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS message_feedback (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id   TEXT NOT NULL,
    message_id   TEXT NOT NULL,
    agent_id     TEXT NOT NULL,
    rating       TEXT NOT NULL,
    reason       TEXT,
    user_id      TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(session_id, message_id)
  );
  CREATE INDEX IF NOT EXISTS idx_feedback_agent ON message_feedback(agent_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_feedback_session ON message_feedback(session_id);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS security_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id        TEXT NOT NULL,
    session_id      TEXT,
    event_type      TEXT NOT NULL,
    severity        TEXT NOT NULL,
    action          TEXT NOT NULL,
    input_hash      TEXT NOT NULL,
    input_excerpt   TEXT,
    pattern_matched TEXT,
    score           REAL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_security_agent ON security_events(agent_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_security_type ON security_events(event_type, action);

  CREATE TABLE IF NOT EXISTS security_rules (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    pattern     TEXT NOT NULL,
    rule_type   TEXT NOT NULL,
    severity    TEXT NOT NULL DEFAULT 'medium',
    action      TEXT NOT NULL DEFAULT 'flagged',
    is_system   INTEGER NOT NULL DEFAULT 0,
    enabled     INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Pre-populate system security rules (idempotent via INSERT OR IGNORE)
const systemRules = [
  {
    name: "ignore_instructions",
    description: "Detects attempts to override agent instructions",
    pattern: JSON.stringify(["ignore previous", "ignore your instructions", "ignore all instructions", "esqueca suas instrucoes", "ignore tudo"]),
    rule_type: "keyword",
    severity: "high",
    action: "blocked",
  },
  {
    name: "system_prompt_leak",
    description: "Detects attempts to extract the system prompt",
    pattern: JSON.stringify(["repeat your system prompt", "what are your instructions", "show me your soul", "mostre seu prompt"]),
    rule_type: "keyword",
    severity: "high",
    action: "flagged",
  },
  {
    name: "role_override",
    description: "Detects attempts to redefine the agent role",
    pattern: JSON.stringify(["you are now", "act as", "pretend you are", "voce agora eh", "finja que"]),
    rule_type: "keyword",
    severity: "medium",
    action: "flagged",
  },
  {
    name: "jailbreak_dan",
    description: "Detects DAN-style jailbreak attempts",
    pattern: JSON.stringify(["DAN", "do anything now", "jailbreak", "developer mode"]),
    rule_type: "keyword",
    severity: "critical",
    action: "blocked",
  },
  {
    name: "data_exfiltration",
    description: "Detects attempts to exfiltrate data",
    pattern: JSON.stringify(["list all users", "show database", "dump your memory", "listar todos os usuarios"]),
    rule_type: "keyword",
    severity: "high",
    action: "blocked",
  },
];

const insertRule = db.prepare(`
  INSERT OR IGNORE INTO security_rules (name, description, pattern, rule_type, severity, action, is_system)
  VALUES (@name, @description, @pattern, @rule_type, @severity, @action, 1)
`);
for (const rule of systemRules) {
  insertRule.run(rule);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS webhooks (
    id          TEXT PRIMARY KEY,
    agent_id    TEXT NOT NULL,
    name        TEXT NOT NULL,
    secret      TEXT NOT NULL,
    enabled     INTEGER NOT NULL DEFAULT 1,
    description TEXT,
    filters     TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_webhooks_agent ON webhooks(agent_id);

  CREATE TABLE IF NOT EXISTS webhook_events (
    id           TEXT PRIMARY KEY,
    webhook_id   TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    agent_id     TEXT NOT NULL,
    received_at  TEXT NOT NULL DEFAULT (datetime('now')),
    headers      TEXT NOT NULL,
    payload      TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending',
    error        TEXT,
    processed_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_webhook_events_webhook ON webhook_events(webhook_id);
  CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
`);

export { db };
