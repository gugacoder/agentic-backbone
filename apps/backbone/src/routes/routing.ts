import { Hono } from "hono";
import { db } from "../db/index.js";
import { requireSysuser } from "./auth-helpers.js";
import {
  resolve,
  listPlans,
  getActivePlan,
  setActivePlan,
} from "../settings/llm.js";

export const routingRoutes = new Hono();

// --- Static price table: USD per 1M tokens (blended avg input + output) ---

const MODEL_PRICE_PER_M: Record<string, number> = {
  "anthropic/claude-haiku-4-5": 0.75,
  "anthropic/claude-haiku-4-5-20251001": 0.75,
  "anthropic/claude-sonnet-4-6": 9.0,
  "anthropic/claude-opus-4-6": 45.0,
  "openai/gpt-4o": 6.25,
  "openai/gpt-4o-mini": 0.375,
  "openai/gpt-4o-mini-2024-07-18": 0.375,
  "google/gemini-flash-1.5": 0.1875,
  "google/gemini-pro-1.5": 3.125,
  "google/gemini-2.0-flash": 0.1875,
  "meta-llama/llama-3.1-70b-instruct": 0.5,
  "meta-llama/llama-3.3-70b-instruct": 0.5,
};

const DEFAULT_PRICE_PER_M = 3.0;
const AVG_TOKENS_PER_EXECUTION = 1000;
const TOKENS_PER_M = 1_000_000;

function priceFor(model: string | null | undefined): number {
  if (!model) return DEFAULT_PRICE_PER_M;
  return MODEL_PRICE_PER_M[model] ?? DEFAULT_PRICE_PER_M;
}

function costUsd(count: number, model: string | null | undefined): number {
  return (count * AVG_TOKENS_PER_EXECUTION * priceFor(model)) / TOKENS_PER_M;
}

// ── GET /settings/plans ───────────────────────────────────

routingRoutes.get("/settings/plans", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const plans = listPlans();
  const active = getActivePlan();
  return c.json({ plans, activePlan: active.name });
});

// ── PUT /settings/plans/active ───────────────────────────────────

routingRoutes.put("/settings/plans/active", async (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const body = await c.req.json<{ name: string }>();
  if (!body.name) {
    return c.json({ error: "'name' is required" }, 400);
  }

  try {
    setActivePlan(body.name);
    return c.json({ activePlan: body.name });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

// ── GET /agents/:id/routing-stats ──────────────────────────

routingRoutes.get("/agents/:id/routing-stats", (c) => {
  const agentId = c.req.param("id");

  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
    .toISOString()
    .slice(0, 10);

  const from = c.req.query("from") ?? sevenDaysAgo;
  const to = c.req.query("to") ?? today;

  const toEnd = `${to}T23:59:59.999Z`;
  const fromStart = `${from}T00:00:00.000Z`;

  // Query heartbeat_log
  const heartbeatRows = db
    .prepare(
      `SELECT model_used, COUNT(*) as cnt
       FROM heartbeat_log
       WHERE agent_id = ? AND ts >= ? AND ts <= ?
       GROUP BY model_used`
    )
    .all(agentId, fromStart, toEnd) as {
    model_used: string | null;
    cnt: number;
  }[];

  // Query cron_run_log
  const cronRows = db
    .prepare(
      `SELECT model_used, COUNT(*) as cnt
       FROM cron_run_log
       WHERE agent_id = ? AND ts >= ? AND ts <= ?
       GROUP BY model_used`
    )
    .all(agentId, fromStart, toEnd) as {
    model_used: string | null;
    cnt: number;
  }[];

  // Combine rows
  const allRows = [...heartbeatRows, ...cronRows];

  // Aggregate model distribution
  const modelCounts = new Map<string, number>();
  let totalExecutions = 0;

  for (const row of allRows) {
    totalExecutions += row.cnt;
    const model = row.model_used ?? "unknown";
    modelCounts.set(model, (modelCounts.get(model) ?? 0) + row.cnt);
  }

  // Build model distribution
  const modelDistribution: Record<string, { count: number; pct: number }> = {};
  for (const [model, count] of modelCounts.entries()) {
    modelDistribution[model] = {
      count,
      pct: totalExecutions > 0 ? Math.round((count / totalExecutions) * 100) / 100 : 0,
    };
  }

  // Cost estimate
  let totalCostUsd = 0;
  for (const [model, count] of modelCounts.entries()) {
    totalCostUsd += costUsd(count, model === "unknown" ? null : model);
  }

  return c.json({
    agentId,
    period: { from, to },
    totalExecutions,
    modelDistribution,
    estimatedCostUsd: Math.round(totalCostUsd * 10000) / 10000,
    pricingNote: `Estimated using ${AVG_TOKENS_PER_EXECUTION} avg tokens/execution. Static pricing table.`,
    activePlan: getActivePlan().name,
  });
});

// ── POST /settings/routing/resolve ────────────────────────

routingRoutes.post("/settings/routing/resolve", async (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const body = await c.req.json<{ role?: string }>();
  const role = body.role ?? "conversation";
  const resolved = resolve(role);

  return c.json({
    role,
    model: resolved.model,
    provider: resolved.provider,
    parameters: resolved.parameters,
    plan: getActivePlan().name,
  });
});
