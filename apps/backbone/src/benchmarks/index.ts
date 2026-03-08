import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { eventBus } from "../events/index.js";
import { getAgent } from "../agents/registry.js";
import { runAgent } from "../agent/index.js";
import { resolveModel } from "../settings/llm.js";
import { emitNotification } from "../notifications/index.js";

// ── Benchmark config from AGENT.yml frontmatter ──────────────────────────────

interface BenchmarkConfig {
  auto_benchmark: boolean;
  eval_set_id?: string;
  regression_threshold: number;
  alert_on_regression: boolean;
}

function getBenchmarkConfig(agentId: string): BenchmarkConfig {
  const agent = getAgent(agentId);
  const raw = (agent?.metadata?.["benchmark"] as Partial<BenchmarkConfig>) ?? {};
  return {
    auto_benchmark: raw.auto_benchmark === true,
    eval_set_id: typeof raw.eval_set_id === "string" ? raw.eval_set_id : undefined,
    regression_threshold:
      typeof raw.regression_threshold === "number" ? raw.regression_threshold : -0.05,
    alert_on_regression: raw.alert_on_regression !== false,
  };
}

// ── Eval set lookup ──────────────────────────────────────────────────────────

interface EvalSetRow {
  id: number;
  name: string;
}

function getAgentEvalSets(agentId: string): EvalSetRow[] {
  return db
    .prepare("SELECT id, name FROM eval_sets WHERE agent_id = ? ORDER BY created_at DESC")
    .all(agentId) as EvalSetRow[];
}

// ── LLM-as-judge ─────────────────────────────────────────────────────────────

const JUDGE_PROMPT = (input: string, expected: string, actual: string): string =>
  `Voce eh um avaliador de qualidade de respostas de agentes de IA.

Dado o seguinte contexto:
- Entrada do usuario: ${input}
- Resposta esperada: ${expected}
- Resposta real do agente: ${actual}

Avalie a qualidade da resposta real em relacao a esperada numa escala de 0.0 a 1.0, onde:
- 1.0 = semanticamente equivalente ou melhor
- 0.7 = resposta correta mas incompleta ou com palavras diferentes
- 0.4 = parcialmente correta, informacoes importantes ausentes
- 0.0 = incorreta ou irrelevante

Responda APENAS com JSON no formato: {"score": 0.85, "reasoning": "..."}`;

async function collectAgentText(
  gen: AsyncGenerator<import("../agent/index.js").AgentEvent>
): Promise<string> {
  const parts: string[] = [];
  for await (const event of gen) {
    if (event.type === "text") parts.push(event.content);
  }
  return parts.join("");
}

async function judgeResponse(
  input: string,
  expected: string,
  actual: string
): Promise<{ score: number; reasoning: string }> {
  try {
    const model = resolveModel("conversation");
    const apiKey = process.env.OPENROUTER_API_KEY!;
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: JUDGE_PROMPT(input, expected, actual) }],
        temperature: 0,
      }),
    });
    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { score?: number; reasoning?: string };
      return {
        score: typeof parsed.score === "number" ? parsed.score : 0,
        reasoning: parsed.reasoning ?? "",
      };
    }
  } catch (err) {
    console.error("[benchmark] judge call failed:", err);
  }
  return { score: 0, reasoning: "" };
}

// ── Pipeline execution ────────────────────────────────────────────────────────

interface EvalCaseRow {
  id: number;
  input: string;
  expected: string;
}

interface PrevCaseRow {
  case_id: string;
  response_after: string;
  score_after: number | null;
}

async function runBenchmarkPipeline(
  benchmarkId: string,
  agentId: string,
  evalSetId: number,
  scoreBefore: number | null,
  regressionThreshold: number,
  alertOnRegression: boolean
): Promise<void> {
  try {
    db.prepare(
      "UPDATE benchmark_runs SET status = 'running', started_at = datetime('now') WHERE id = ?"
    ).run(benchmarkId);

    const cases = db
      .prepare("SELECT id, input, expected FROM eval_cases WHERE set_id = ?")
      .all(evalSetId) as EvalCaseRow[];

    // Load previous run's cases for response_before / score_before per case
    const prevRun = db
      .prepare(
        `SELECT id FROM benchmark_runs
         WHERE agent_id = ? AND eval_set_id = ? AND status = 'done' AND id != ?
         ORDER BY created_at DESC LIMIT 1`
      )
      .get(agentId, String(evalSetId), benchmarkId) as { id: string } | undefined;

    const prevCasesMap = new Map<string, PrevCaseRow>();
    if (prevRun) {
      const prevCases = db
        .prepare(
          "SELECT case_id, response_after, score_after FROM benchmark_cases WHERE benchmark_id = ?"
        )
        .all(prevRun.id) as PrevCaseRow[];
      for (const pc of prevCases) {
        prevCasesMap.set(pc.case_id, pc);
      }
    }

    let totalScore = 0;
    let passed = 0;
    let failed = 0;

    for (const evalCase of cases) {
      const caseIdStr = String(evalCase.id);

      let actual = "";
      try {
        actual = await collectAgentText(runAgent(evalCase.input));
      } catch (err) {
        console.error(`[benchmark] agent run failed for case ${evalCase.id}:`, err);
        actual = "[error: agent failed]";
      }

      const { score, reasoning } = await judgeResponse(evalCase.input, evalCase.expected, actual);

      const isPassed = score >= 0.7;
      if (isPassed) passed++;
      else failed++;
      totalScore += score;

      const prev = prevCasesMap.get(caseIdStr);
      const caseSkoreBefore = prev?.score_after ?? null;
      const caseDelta = caseSkoreBefore !== null ? score - caseSkoreBefore : null;

      db.prepare(
        `INSERT INTO benchmark_cases
         (id, benchmark_id, case_id, input, expected, response_before, response_after, score_before, score_after, delta, judge_reasoning)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        randomUUID(),
        benchmarkId,
        caseIdStr,
        evalCase.input,
        evalCase.expected,
        prev?.response_after ?? null,
        actual,
        caseSkoreBefore,
        score,
        caseDelta,
        reasoning
      );
    }

    const scoreAfter = cases.length > 0 ? totalScore / cases.length : 0;
    const delta = scoreBefore !== null ? scoreAfter - scoreBefore : null;
    const isRegression = delta !== null && delta < regressionThreshold ? 1 : 0;

    db.prepare(
      `UPDATE benchmark_runs
       SET status = 'done', score_before = ?, score_after = ?, delta = ?, regression = ?,
           cases_total = ?, cases_passed = ?, cases_failed = ?, completed_at = datetime('now')
       WHERE id = ?`
    ).run(scoreBefore, scoreAfter, delta, isRegression, cases.length, passed, failed, benchmarkId);

    console.log(
      `[benchmark] run ${benchmarkId} done — agent=${agentId} score=${scoreAfter.toFixed(3)} delta=${delta?.toFixed(3) ?? "n/a"} regression=${isRegression}`
    );

    if (isRegression && alertOnRegression) {
      emitNotification({
        type: "benchmark:regression",
        severity: "warning",
        agentId,
        title: `Regressão detectada — ${agentId}`,
        body: `Score caiu ${Math.abs(delta!).toFixed(3)} (de ${scoreBefore?.toFixed(3)} para ${scoreAfter.toFixed(3)})`,
        metadata: { benchmarkId, delta, scoreAfter, scoreBefore },
      });
    }
  } catch (err) {
    console.error(`[benchmark] pipeline failed for ${benchmarkId}:`, err);
    db.prepare(
      "UPDATE benchmark_runs SET status = 'failed', completed_at = datetime('now') WHERE id = ?"
    ).run(benchmarkId);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function scheduleBenchmarkRun(
  agentId: string,
  evalSetId: number,
  versionFrom: string | null,
  versionTo: string,
  trigger: string = "version_change"
): Promise<string> {
  const benchmarkId = randomUUID();

  // Get score_before from the last completed run for this agent + eval set
  const lastRun = db
    .prepare(
      `SELECT score_after FROM benchmark_runs
       WHERE agent_id = ? AND eval_set_id = ? AND status = 'done'
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(agentId, String(evalSetId)) as { score_after: number | null } | undefined;

  const scoreBefore = lastRun?.score_after ?? null;

  db.prepare(
    `INSERT INTO benchmark_runs
     (id, agent_id, trigger, version_from, version_to, eval_set_id, status, score_before, cases_total)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 0)`
  ).run(benchmarkId, agentId, trigger, versionFrom, versionTo, String(evalSetId), scoreBefore);

  const config = getBenchmarkConfig(agentId);

  // Fire and forget — does not block caller
  runBenchmarkPipeline(
    benchmarkId,
    agentId,
    evalSetId,
    scoreBefore,
    config.regression_threshold,
    config.alert_on_regression
  ).catch((err) => console.error("[benchmark] unhandled pipeline error:", err));

  return benchmarkId;
}

// ── Event subscription ────────────────────────────────────────────────────────

export function initBenchmarkTrigger(): void {
  eventBus.on("config:version_changed", ({ agentId, file, versionFrom, versionTo }) => {
    if (!["SOUL.md", "CONVERSATION.md"].includes(file)) return;

    const evalSets = getAgentEvalSets(agentId);
    if (evalSets.length === 0) return; // no golden sets: silent skip

    const config = getBenchmarkConfig(agentId);
    if (!config.auto_benchmark) return;

    // Select configured eval set by name or ID, fallback to most recent
    let evalSet = evalSets[0]!;
    if (config.eval_set_id) {
      const found = evalSets.find(
        (s) => s.name === config.eval_set_id || String(s.id) === config.eval_set_id
      );
      if (found) evalSet = found;
    }

    scheduleBenchmarkRun(agentId, evalSet.id, versionFrom, versionTo).catch((err) =>
      console.error(`[benchmark] failed to schedule run for ${agentId}:`, err)
    );

    console.log(`[benchmark] triggered for ${agentId} (${file} → v${versionTo})`);
  });

  console.log("[benchmark] trigger initialized — listening for config:version_changed");
}
