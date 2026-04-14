import { Hono } from "hono";
import type { Context } from "hono";
import { db } from "../db/index.js";
import { parseBody } from "./helpers.js";
import { runAgent } from "../agent/index.js";
import { resolve, getProviderConfig } from "../settings/llm.js";

export const evaluationRoutes = new Hono();

// ── Eval Sets ──────────────────────────────────────────────

evaluationRoutes.get("/agents/:id/eval-sets", (c: Context) => {
  const agentId = c.req.param("id");
  const sets = db
    .prepare("SELECT * FROM eval_sets WHERE agent_id = ? ORDER BY created_at DESC")
    .all(agentId);
  return c.json(sets);
});

evaluationRoutes.post("/agents/:id/eval-sets", async (c: Context) => {
  const agentId = c.req.param("id");
  const body = await parseBody<{ name: string; description?: string }>(c);
  if (body instanceof Response) return body;
  if (!body.name) return c.json({ error: "name is required" }, 400);

  const result = db
    .prepare("INSERT INTO eval_sets (agent_id, name, description) VALUES (?, ?, ?)")
    .run(agentId, body.name, body.description ?? null);

  const set = db
    .prepare("SELECT * FROM eval_sets WHERE id = ?")
    .get(result.lastInsertRowid);
  return c.json(set, 201);
});

evaluationRoutes.get("/agents/:id/eval-sets/:setId", (c: Context) => {
  const agentId = c.req.param("id");
  const setId = c.req.param("setId");
  const set = db
    .prepare("SELECT * FROM eval_sets WHERE id = ? AND agent_id = ?")
    .get(setId, agentId);
  if (!set) return c.json({ error: "not found" }, 404);

  const cases = db
    .prepare("SELECT * FROM eval_cases WHERE set_id = ? ORDER BY created_at ASC")
    .all(setId);
  return c.json({ ...(set as object), cases });
});

evaluationRoutes.patch("/agents/:id/eval-sets/:setId", async (c: Context) => {
  const agentId = c.req.param("id");
  const setId = c.req.param("setId");
  const set = db
    .prepare("SELECT id FROM eval_sets WHERE id = ? AND agent_id = ?")
    .get(setId, agentId);
  if (!set) return c.json({ error: "not found" }, 404);

  const body = await parseBody<{ name?: string; description?: string }>(c);
  if (body instanceof Response) return body;

  db.prepare(
    "UPDATE eval_sets SET name = COALESCE(?, name), description = COALESCE(?, description), updated_at = datetime('now') WHERE id = ?"
  ).run(body.name ?? null, body.description ?? null, setId);

  const updated = db.prepare("SELECT * FROM eval_sets WHERE id = ?").get(setId);
  return c.json(updated);
});

evaluationRoutes.delete("/agents/:id/eval-sets/:setId", (c: Context) => {
  const agentId = c.req.param("id");
  const setId = c.req.param("setId");
  const set = db
    .prepare("SELECT id FROM eval_sets WHERE id = ? AND agent_id = ?")
    .get(setId, agentId);
  if (!set) return c.json({ error: "not found" }, 404);

  db.prepare("DELETE FROM eval_sets WHERE id = ?").run(setId);
  return c.json({ ok: true });
});

// ── Eval Cases ─────────────────────────────────────────────

evaluationRoutes.post("/agents/:id/eval-sets/:setId/cases", async (c: Context) => {
  const agentId = c.req.param("id");
  const setId = c.req.param("setId");
  const set = db
    .prepare("SELECT id FROM eval_sets WHERE id = ? AND agent_id = ?")
    .get(setId, agentId);
  if (!set) return c.json({ error: "not found" }, 404);

  const body = await parseBody<{ input: string; expected: string; tags?: string }>(c);
  if (body instanceof Response) return body;
  if (!body.input || !body.expected) {
    return c.json({ error: "input and expected are required" }, 400);
  }

  const result = db
    .prepare("INSERT INTO eval_cases (set_id, input, expected, tags) VALUES (?, ?, ?, ?)")
    .run(setId, body.input, body.expected, body.tags ?? null);

  const newCase = db.prepare("SELECT * FROM eval_cases WHERE id = ?").get(result.lastInsertRowid);
  return c.json(newCase, 201);
});

evaluationRoutes.patch("/agents/:id/eval-sets/:setId/cases/:caseId", async (c: Context) => {
  const agentId = c.req.param("id");
  const setId = c.req.param("setId");
  const caseId = c.req.param("caseId");

  const set = db
    .prepare("SELECT id FROM eval_sets WHERE id = ? AND agent_id = ?")
    .get(setId, agentId);
  if (!set) return c.json({ error: "not found" }, 404);

  const evalCase = db
    .prepare("SELECT id FROM eval_cases WHERE id = ? AND set_id = ?")
    .get(caseId, setId);
  if (!evalCase) return c.json({ error: "not found" }, 404);

  const body = await parseBody<{ input?: string; expected?: string; tags?: string }>(c);
  if (body instanceof Response) return body;

  db.prepare(
    "UPDATE eval_cases SET input = COALESCE(?, input), expected = COALESCE(?, expected), tags = COALESCE(?, tags) WHERE id = ?"
  ).run(body.input ?? null, body.expected ?? null, body.tags ?? null, caseId);

  const updated = db.prepare("SELECT * FROM eval_cases WHERE id = ?").get(caseId);
  return c.json(updated);
});

evaluationRoutes.delete("/agents/:id/eval-sets/:setId/cases/:caseId", (c: Context) => {
  const agentId = c.req.param("id");
  const setId = c.req.param("setId");
  const caseId = c.req.param("caseId");

  const set = db
    .prepare("SELECT id FROM eval_sets WHERE id = ? AND agent_id = ?")
    .get(setId, agentId);
  if (!set) return c.json({ error: "not found" }, 404);

  const evalCase = db
    .prepare("SELECT id FROM eval_cases WHERE id = ? AND set_id = ?")
    .get(caseId, setId);
  if (!evalCase) return c.json({ error: "not found" }, 404);

  db.prepare("DELETE FROM eval_cases WHERE id = ?").run(caseId);
  return c.json({ ok: true });
});

// ── Eval Runs ───────────────────────────────────────────────

async function collectAgentText(gen: AsyncGenerator<import("../agent/index.js").SDKMessage>): Promise<string> {
  const parts: string[] = [];
  for await (const msg of gen) {
    if (msg.type === "assistant") {
      const aMsg = msg as import("../agent/index.js").SDKAssistantMessage;
      for (const b of aMsg.message.content) {
        if (b.type === "text") parts.push((b as { text: string }).text);
      }
    }
  }
  return parts.join("");
}

const JUDGE_PROMPT = (input: string, expected: string, actual: string) => `Voce eh um avaliador de qualidade de respostas de agentes de IA.

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

async function runEvalPipeline(runId: number, agentId: string, cases: Array<{ id: number; input: string; expected: string }>) {
  try {
    let totalScore = 0;
    let passed = 0;
    let failed = 0;

    for (const evalCase of cases) {
      const startMs = Date.now();
      let actual = "";
      try {
        actual = await collectAgentText(runAgent(evalCase.input));
      } catch (err) {
        console.error(`[eval] agent run failed for case ${evalCase.id}:`, err);
        actual = "[error: agent failed]";
      }
      const latencyMs = Date.now() - startMs;

      let score = 0;
      let reasoning = "";
      try {
        const { model, provider } = resolve("conversation");
        const conf = getProviderConfig(provider);
        const apiKey = process.env[conf.apiKeyEnv]!;
        const resp = await fetch(`${conf.baseURL}/chat/completions`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: JUDGE_PROMPT(evalCase.input, evalCase.expected, actual) }],
            temperature: 0,
          }),
        });
        const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
        const content = data.choices?.[0]?.message?.content ?? "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as { score?: number; reasoning?: string };
          score = typeof parsed.score === "number" ? parsed.score : 0;
          reasoning = parsed.reasoning ?? "";
        }
      } catch (err) {
        console.error(`[eval] judge failed for case ${evalCase.id}:`, err);
      }

      const isPassed = score >= 0.7 ? 1 : 0;
      if (isPassed) passed++; else failed++;
      totalScore += score;

      db.prepare(
        "INSERT INTO eval_results (run_id, case_id, actual, score, reasoning, passed, latency_ms) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(runId, evalCase.id, actual, score, reasoning, isPassed, latencyMs);
    }

    const scoreAvg = cases.length > 0 ? totalScore / cases.length : 0;
    db.prepare(
      "UPDATE eval_runs SET status = 'done', score_avg = ?, passed = ?, failed = ?, finished_at = datetime('now') WHERE id = ?"
    ).run(scoreAvg, passed, failed, runId);
  } catch (err) {
    console.error(`[eval] pipeline failed for run ${runId}:`, err);
    db.prepare("UPDATE eval_runs SET status = 'error', finished_at = datetime('now') WHERE id = ?").run(runId);
  }
}

evaluationRoutes.post("/agents/:id/eval-sets/:setId/runs", (c: Context) => {
  const agentId = c.req.param("id");
  const setId = c.req.param("setId");

  const set = db
    .prepare("SELECT id FROM eval_sets WHERE id = ? AND agent_id = ?")
    .get(setId, agentId);
  if (!set) return c.json({ error: "not found" }, 404);

  const cases = db
    .prepare("SELECT id, input, expected FROM eval_cases WHERE set_id = ?")
    .all(setId) as Array<{ id: number; input: string; expected: string }>;

  const result = db
    .prepare(
      "INSERT INTO eval_runs (set_id, agent_id, status, total_cases, started_at) VALUES (?, ?, 'running', ?, datetime('now'))"
    )
    .run(setId, agentId, cases.length);

  const runId = result.lastInsertRowid as number;

  // Fire and forget — do not await
  runEvalPipeline(runId, agentId, cases).catch((err) =>
    console.error("[eval] unhandled pipeline error:", err)
  );

  return c.json({ runId, status: "running" }, 202);
});

evaluationRoutes.get("/agents/:id/eval-runs", (c: Context) => {
  const agentId = c.req.param("id");
  const runs = db
    .prepare("SELECT * FROM eval_runs WHERE agent_id = ? ORDER BY created_at DESC")
    .all(agentId);
  return c.json(runs);
});

evaluationRoutes.get("/agents/:id/eval-runs/:runId", (c: Context) => {
  const agentId = c.req.param("id");
  const runId = c.req.param("runId");
  const run = db
    .prepare("SELECT * FROM eval_runs WHERE id = ? AND agent_id = ?")
    .get(runId, agentId);
  if (!run) return c.json({ error: "not found" }, 404);

  const results = db
    .prepare(`
      SELECT er.*, ec.input, ec.expected
      FROM eval_results er
      JOIN eval_cases ec ON ec.id = er.case_id
      WHERE er.run_id = ?
      ORDER BY er.id ASC
    `)
    .all(runId);
  return c.json({ ...(run as object), results });
});
