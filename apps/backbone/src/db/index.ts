import Database, { type Database as DatabaseType } from "better-sqlite3";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { DATA_DIR } from "../context/paths.js";

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

db.exec(`
  CREATE TABLE IF NOT EXISTS lgpd_data_map (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id       TEXT NOT NULL,
    data_type      TEXT NOT NULL,
    label          TEXT NOT NULL,
    purpose        TEXT NOT NULL,
    legal_basis    TEXT NOT NULL,
    retention_days INTEGER,
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_lgpd_map_agent_type ON lgpd_data_map(agent_id, data_type);

  CREATE TABLE IF NOT EXISTS lgpd_consent_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id    TEXT NOT NULL,
    channel_id  TEXT NOT NULL,
    user_ref    TEXT NOT NULL,
    action      TEXT NOT NULL,
    purpose     TEXT NOT NULL,
    ip_address  TEXT,
    recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_lgpd_consent_agent ON lgpd_consent_log(agent_id);
  CREATE INDEX IF NOT EXISTS idx_lgpd_consent_user ON lgpd_consent_log(user_ref);

  CREATE TABLE IF NOT EXISTS lgpd_rights_requests (
    id           TEXT PRIMARY KEY,
    user_ref     TEXT NOT NULL,
    right_type   TEXT NOT NULL,
    agent_id     TEXT,
    description  TEXT,
    status       TEXT NOT NULL DEFAULT 'open',
    response     TEXT,
    requested_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at  TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_lgpd_rights_user ON lgpd_rights_requests(user_ref);
  CREATE INDEX IF NOT EXISTS idx_lgpd_rights_status ON lgpd_rights_requests(status);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS agent_handoffs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    supervisor_id  TEXT NOT NULL,
    member_id      TEXT NOT NULL,
    label          TEXT NOT NULL,
    trigger_intent TEXT NOT NULL,
    priority       INTEGER DEFAULT 0,
    enabled        INTEGER DEFAULT 1,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_handoffs_sup_member ON agent_handoffs(supervisor_id, member_id);
  CREATE INDEX IF NOT EXISTS idx_handoffs_supervisor ON agent_handoffs(supervisor_id);
`);

// Idempotent migration: add orchestration columns to sessions
try { db.exec(`ALTER TABLE sessions ADD COLUMN orchestration_path TEXT`); } catch {}
try { db.exec(`ALTER TABLE sessions ADD COLUMN current_agent_id TEXT`); } catch {}

// Idempotent migration: add starred column
try { db.exec(`ALTER TABLE sessions ADD COLUMN starred INTEGER NOT NULL DEFAULT 0`); } catch {}

// Idempotent migration: add system_hash column (invalidate SDK session on prompt change)
try { db.exec(`ALTER TABLE sessions ADD COLUMN system_hash TEXT`); } catch {}

db.exec(`
  CREATE TABLE IF NOT EXISTS agent_quotas (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id             TEXT NOT NULL UNIQUE,
    max_tokens_per_hour  INTEGER,
    max_heartbeats_day   INTEGER,
    max_tool_timeout_ms  INTEGER DEFAULT 30000,
    max_tokens_per_run   INTEGER,
    pause_on_exceed      INTEGER NOT NULL DEFAULT 1,
    updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS agent_quota_usage (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id     TEXT NOT NULL,
    window_type  TEXT NOT NULL,
    window_start TEXT NOT NULL,
    tokens_used  INTEGER NOT NULL DEFAULT 0,
    heartbeats   INTEGER NOT NULL DEFAULT 0,
    tool_calls   INTEGER NOT NULL DEFAULT 0,
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_quota_usage_agent_window ON agent_quota_usage(agent_id, window_type, window_start);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS config_versions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id    TEXT NOT NULL,
    file_name   TEXT NOT NULL,
    version_num INTEGER NOT NULL,
    file_path   TEXT NOT NULL,
    size_bytes  INTEGER,
    change_note TEXT,
    eval_run_id INTEGER,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    created_by  TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_versions_agent_file ON config_versions(agent_id, file_name);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS message_ratings (
    id            TEXT PRIMARY KEY,
    session_id    TEXT NOT NULL,
    message_index INTEGER NOT NULL,
    agent_id      TEXT NOT NULL,
    channel_type  TEXT NOT NULL,
    rating        TEXT NOT NULL,
    reason        TEXT,
    reason_cat    TEXT,
    user_ref      TEXT,
    rated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(session_id, message_index)
  );
  CREATE INDEX IF NOT EXISTS idx_ratings_agent ON message_ratings(agent_id);
  CREATE INDEX IF NOT EXISTS idx_ratings_session ON message_ratings(session_id);
  CREATE INDEX IF NOT EXISTS idx_ratings_rating ON message_ratings(rating);
  CREATE INDEX IF NOT EXISTS idx_ratings_rated_at ON message_ratings(rated_at);
`);

// Idempotent migration: add model routing columns to heartbeat_log
try { db.exec(`ALTER TABLE heartbeat_log ADD COLUMN model_used TEXT`); } catch {}
try { db.exec(`ALTER TABLE heartbeat_log ADD COLUMN routing_rule TEXT`); } catch {}

// Idempotent migration: add model routing columns to cron_run_log
try { db.exec(`ALTER TABLE cron_run_log ADD COLUMN model_used TEXT`); } catch {}
try { db.exec(`ALTER TABLE cron_run_log ADD COLUMN routing_rule TEXT`); } catch {}

db.exec(`
  CREATE TABLE IF NOT EXISTS mcp_tool_calls (
    id          TEXT PRIMARY KEY,
    agent_id    TEXT NOT NULL,
    adapter_id  TEXT NOT NULL,
    tool_name   TEXT NOT NULL,
    input       TEXT NOT NULL,
    output      TEXT,
    error       TEXT,
    duration_ms INTEGER,
    called_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_agent ON mcp_tool_calls(agent_id);
  CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_adapter ON mcp_tool_calls(adapter_id);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS benchmark_runs (
    id              TEXT PRIMARY KEY,
    agent_id        TEXT NOT NULL,
    trigger         TEXT NOT NULL,
    version_from    TEXT,
    version_to      TEXT NOT NULL,
    eval_set_id     TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    score_before    REAL,
    score_after     REAL,
    delta           REAL,
    regression      INTEGER NOT NULL DEFAULT 0,
    cases_total     INTEGER,
    cases_passed    INTEGER,
    cases_failed    INTEGER,
    started_at      TEXT,
    completed_at    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_benchmark_runs_agent ON benchmark_runs(agent_id);
  CREATE INDEX IF NOT EXISTS idx_benchmark_runs_status ON benchmark_runs(status);
  CREATE INDEX IF NOT EXISTS idx_benchmark_runs_created ON benchmark_runs(created_at);

  CREATE TABLE IF NOT EXISTS benchmark_cases (
    id              TEXT PRIMARY KEY,
    benchmark_id    TEXT NOT NULL REFERENCES benchmark_runs(id) ON DELETE CASCADE,
    case_id         TEXT NOT NULL,
    input           TEXT NOT NULL,
    expected        TEXT NOT NULL,
    response_before TEXT,
    response_after  TEXT NOT NULL,
    score_before    REAL,
    score_after     REAL,
    delta           REAL,
    judge_reasoning TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_benchmark_cases_benchmark ON benchmark_cases(benchmark_id);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS circuit_breaker_config (
    agent_id              TEXT PRIMARY KEY,
    enabled               INTEGER NOT NULL DEFAULT 1,
    max_consecutive_fails INTEGER NOT NULL DEFAULT 5,
    error_rate_threshold  REAL NOT NULL DEFAULT 0.5,
    error_rate_window_min INTEGER NOT NULL DEFAULT 10,
    max_actions_per_hour  INTEGER NOT NULL DEFAULT 100,
    max_actions_per_day   INTEGER NOT NULL DEFAULT 1000,
    cooldown_min          INTEGER NOT NULL DEFAULT 30,
    auto_resume           INTEGER NOT NULL DEFAULT 0,
    updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS circuit_breaker_events (
    id              TEXT PRIMARY KEY,
    agent_id        TEXT NOT NULL,
    event_type      TEXT NOT NULL,
    trigger_reason  TEXT,
    context         TEXT,
    actor           TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_cb_events_agent   ON circuit_breaker_events(agent_id);
  CREATE INDEX IF NOT EXISTS idx_cb_events_created ON circuit_breaker_events(created_at);
  CREATE INDEX IF NOT EXISTS idx_cb_events_type    ON circuit_breaker_events(event_type);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS compliance_classification (
    agent_id           TEXT PRIMARY KEY,
    risk_level         TEXT NOT NULL DEFAULT 'minimal',
    risk_justification TEXT,
    classified_by      TEXT NOT NULL,
    classified_at      TEXT NOT NULL DEFAULT (datetime('now')),
    reviewed_at        TEXT,
    review_due_at      TEXT
  );

  CREATE TABLE IF NOT EXISTS compliance_checklist (
    id         TEXT PRIMARY KEY,
    agent_id   TEXT NOT NULL,
    item_key   TEXT NOT NULL,
    item_label TEXT NOT NULL,
    category   TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'pending',
    evidence   TEXT,
    updated_by TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(agent_id, item_key)
  );

  CREATE INDEX IF NOT EXISTS idx_compliance_checklist_agent ON compliance_checklist(agent_id);

  CREATE TABLE IF NOT EXISTS compliance_reports (
    id           TEXT PRIMARY KEY,
    agent_id     TEXT,
    report_type  TEXT NOT NULL,
    title        TEXT NOT NULL,
    content      TEXT NOT NULL,
    generated_by TEXT NOT NULL,
    generated_at TEXT NOT NULL DEFAULT (datetime('now')),
    period_from  TEXT,
    period_to    TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_compliance_reports_agent ON compliance_reports(agent_id);
  CREATE INDEX IF NOT EXISTS idx_compliance_reports_type  ON compliance_reports(report_type);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// F-161: Billing tables
db.exec(`
  CREATE TABLE IF NOT EXISTS billing_config (
    id                  TEXT PRIMARY KEY DEFAULT 'default',
    currency            TEXT NOT NULL DEFAULT 'BRL',
    default_markup_pct  REAL NOT NULL DEFAULT 0.0,
    agency_name         TEXT,
    agency_document     TEXT,
    agency_address      TEXT,
    agency_bank_info    TEXT,
    agency_logo_url     TEXT,
    invoice_footer      TEXT,
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tenant_billing (
    id                  TEXT PRIMARY KEY,
    tenant_id           TEXT NOT NULL,
    period_year         INTEGER NOT NULL,
    period_month        INTEGER NOT NULL,
    tokens_input        INTEGER NOT NULL DEFAULT 0,
    tokens_output       INTEGER NOT NULL DEFAULT 0,
    tokens_total        INTEGER NOT NULL DEFAULT 0,
    cost_base           REAL NOT NULL DEFAULT 0.0,
    markup_pct          REAL NOT NULL DEFAULT 0.0,
    cost_with_markup    REAL NOT NULL DEFAULT 0.0,
    status              TEXT NOT NULL DEFAULT 'draft',
    finalized_at        TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tenant_id, period_year, period_month)
  );
  CREATE INDEX IF NOT EXISTS idx_tenant_billing_tenant ON tenant_billing(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_tenant_billing_period ON tenant_billing(period_year, period_month);

  CREATE TABLE IF NOT EXISTS tenant_billing_detail (
    id                  TEXT PRIMARY KEY,
    billing_id          TEXT NOT NULL REFERENCES tenant_billing(id) ON DELETE CASCADE,
    agent_id            TEXT NOT NULL,
    agent_label         TEXT NOT NULL,
    model               TEXT NOT NULL,
    operation_type      TEXT NOT NULL,
    tokens_input        INTEGER NOT NULL DEFAULT 0,
    tokens_output       INTEGER NOT NULL DEFAULT 0,
    tokens_total        INTEGER NOT NULL DEFAULT 0,
    cost_base           REAL NOT NULL DEFAULT 0.0,
    invocations         INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_billing_detail_billing ON tenant_billing_detail(billing_id);
  CREATE INDEX IF NOT EXISTS idx_billing_detail_agent ON tenant_billing_detail(agent_id);

  CREATE TABLE IF NOT EXISTS tenant_markup_override (
    tenant_id           TEXT PRIMARY KEY,
    markup_pct          REAL NOT NULL,
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export { db };
