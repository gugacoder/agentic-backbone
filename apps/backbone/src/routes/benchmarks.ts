import { Hono } from "hono";
import { db } from "../db/index.js";
import { scheduleBenchmarkRun } from "../benchmarks/index.js";
import { getAgent } from "../agents/registry.js";

export const benchmarkRoutes = new Hono();

// ── GET /agents/:id/benchmarks ─────────────────────────────────────────────
// List benchmark runs for an agent (paginated)

benchmarkRoutes.get("/agents/:id/benchmarks", (c) => {
  const agentId = c.req.param("id");

  if (!getAgent(agentId)) return c.json({ error: "Agent not found" }, 404);

  const limit = Math.min(parseInt(c.req.query("limit") ?? "20", 10) || 20, 100);
  const offset = parseInt(c.req.query("offset") ?? "0", 10) || 0;

  const rows = db
    .prepare(
      `SELECT id, agent_id, trigger, version_from, version_to, eval_set_id,
              status, score_before, score_after, delta, regression,
              cases_total, cases_passed, cases_failed, started_at, completed_at, created_at
       FROM benchmark_runs
       WHERE agent_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(agentId, limit, offset) as Array<Record<string, unknown>>;

  const total = (
    db
      .prepare("SELECT COUNT(*) as cnt FROM benchmark_runs WHERE agent_id = ?")
      .get(agentId) as { cnt: number }
  ).cnt;

  return c.json({
    agentId,
    total,
    limit,
    offset,
    items: rows.map(mapRun),
  });
});

// ── POST /agents/:id/benchmarks ────────────────────────────────────────────
// Trigger a manual benchmark run (response 202)

benchmarkRoutes.post("/agents/:id/benchmarks", async (c) => {
  const agentId = c.req.param("id");

  if (!getAgent(agentId)) return c.json({ error: "Agent not found" }, 404);

  interface BenchmarkTriggerBody {
    evalSetId?: string | number;
    compareWithVersion?: string;
  }
  const body: BenchmarkTriggerBody = await c.req
    .json<BenchmarkTriggerBody>()
    .catch(() => ({}));

  // Resolve eval set
  let evalSet: { id: number; name: string } | undefined;

  if (body.evalSetId !== undefined) {
    evalSet = db
      .prepare(
        "SELECT id, name FROM eval_sets WHERE agent_id = ? AND (id = ? OR name = ?) LIMIT 1"
      )
      .get(agentId, String(body.evalSetId), String(body.evalSetId)) as
      | { id: number; name: string }
      | undefined;

    if (!evalSet) {
      return c.json({ error: `Eval set '${body.evalSetId}' not found for agent` }, 404);
    }
  } else {
    // Use most recent eval set
    evalSet = db
      .prepare(
        "SELECT id, name FROM eval_sets WHERE agent_id = ? ORDER BY created_at DESC LIMIT 1"
      )
      .get(agentId) as { id: number; name: string } | undefined;

    if (!evalSet) {
      return c.json({ error: "No eval sets found for agent — create a golden set first" }, 422);
    }
  }

  // Resolve versionTo: latest config version for this agent, or "manual"
  const latestVersion = db
    .prepare(
      `SELECT version_num FROM config_versions
       WHERE agent_id = ?
       ORDER BY version_num DESC LIMIT 1`
    )
    .get(agentId) as { version_num: number } | undefined;

  const versionTo = latestVersion ? String(latestVersion.version_num) : "manual";
  const versionFrom = body.compareWithVersion ?? null;

  const benchmarkId = await scheduleBenchmarkRun(
    agentId,
    evalSet.id,
    versionFrom,
    versionTo,
    "manual"
  );

  return c.json(
    {
      benchmarkId,
      status: "pending",
      message: "Benchmark iniciado em background",
      evalSetId: String(evalSet.id),
      evalSetName: evalSet.name,
      versionTo,
    },
    202
  );
});

// ── GET /agents/:id/benchmarks/trend ──────────────────────────────────────
// Score trend by version (must be registered BEFORE /:runId)

benchmarkRoutes.get("/agents/:id/benchmarks/trend", (c) => {
  const agentId = c.req.param("id");

  if (!getAgent(agentId)) return c.json({ error: "Agent not found" }, 404);

  const limit = Math.min(parseInt(c.req.query("limit") ?? "10", 10) || 10, 100);

  const rows = db
    .prepare(
      `SELECT id, version_to, score_after, delta, regression, completed_at, created_at
       FROM benchmark_runs
       WHERE agent_id = ? AND status = 'done'
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(agentId, limit) as Array<{
    id: string;
    version_to: string;
    score_after: number | null;
    delta: number | null;
    regression: number;
    completed_at: string | null;
    created_at: string;
  }>;

  // Return in chronological order (oldest first) for trend display
  const trend = rows.reverse().map((row) => ({
    benchmarkId: row.id,
    version: row.version_to,
    score: row.score_after,
    delta: row.delta,
    regression: row.regression === 1,
    date: (row.completed_at ?? row.created_at).split("T")[0] ?? row.created_at.split(" ")[0],
  }));

  return c.json({ agentId, trend });
});

// ── GET /agents/:id/benchmarks/:runId ─────────────────────────────────────
// Full details of a single benchmark run

benchmarkRoutes.get("/agents/:id/benchmarks/:runId", (c) => {
  const agentId = c.req.param("id");
  const runId = c.req.param("runId");

  const row = db
    .prepare(
      `SELECT id, agent_id, trigger, version_from, version_to, eval_set_id,
              status, score_before, score_after, delta, regression,
              cases_total, cases_passed, cases_failed, started_at, completed_at, created_at
       FROM benchmark_runs
       WHERE id = ? AND agent_id = ?`
    )
    .get(runId, agentId) as Record<string, unknown> | undefined;

  if (!row) return c.json({ error: "Benchmark run not found" }, 404);

  return c.json(mapRun(row));
});

// ── GET /agents/:id/benchmarks/:runId/cases ───────────────────────────────
// Individual cases for a benchmark run

benchmarkRoutes.get("/agents/:id/benchmarks/:runId/cases", (c) => {
  const agentId = c.req.param("id");
  const runId = c.req.param("runId");

  // Verify the run belongs to this agent
  const run = db
    .prepare("SELECT id FROM benchmark_runs WHERE id = ? AND agent_id = ?")
    .get(runId, agentId) as { id: string } | undefined;

  if (!run) return c.json({ error: "Benchmark run not found" }, 404);

  const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10) || 50, 200);
  const offset = parseInt(c.req.query("offset") ?? "0", 10) || 0;

  const rows = db
    .prepare(
      `SELECT id, case_id, input, expected,
              response_before, response_after,
              score_before, score_after, delta, judge_reasoning
       FROM benchmark_cases
       WHERE benchmark_id = ?
       ORDER BY rowid
       LIMIT ? OFFSET ?`
    )
    .all(runId, limit, offset) as Array<{
    id: string;
    case_id: string;
    input: string;
    expected: string;
    response_before: string | null;
    response_after: string;
    score_before: number | null;
    score_after: number | null;
    delta: number | null;
    judge_reasoning: string | null;
  }>;

  const total = (
    db
      .prepare("SELECT COUNT(*) as cnt FROM benchmark_cases WHERE benchmark_id = ?")
      .get(runId) as { cnt: number }
  ).cnt;

  return c.json({
    benchmarkId: runId,
    total,
    limit,
    offset,
    cases: rows.map((row) => ({
      id: row.id,
      caseId: row.case_id,
      input: row.input,
      expected: row.expected,
      responseBefore: row.response_before,
      responseAfter: row.response_after,
      scoreBefore: row.score_before,
      scoreAfter: row.score_after,
      delta: row.delta,
      judgeReasoning: row.judge_reasoning,
    })),
  });
});

// ── Helpers ────────────────────────────────────────────────────────────────

function mapRun(row: Record<string, unknown>) {
  return {
    id: row["id"],
    agentId: row["agent_id"],
    trigger: row["trigger"],
    versionFrom: row["version_from"],
    versionTo: row["version_to"],
    evalSetId: row["eval_set_id"],
    status: row["status"],
    scoreBefore: row["score_before"],
    scoreAfter: row["score_after"],
    delta: row["delta"],
    regression: row["regression"] === 1,
    casesTotal: row["cases_total"],
    casesPassed: row["cases_passed"],
    casesFailed: row["cases_failed"],
    startedAt: row["started_at"],
    completedAt: row["completed_at"],
    createdAt: row["created_at"],
  };
}
