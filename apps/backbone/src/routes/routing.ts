import { Hono } from "hono";
import { db } from "../db/index.js";
import { requireSysuser } from "./auth-helpers.js";
import {
  getRoutingConfig,
  setRoutingConfig,
  resolveModelResult,
  RoutingContext,
  RoutingRule,
  RoutingConfig,
} from "../settings/llm.js";
import { readYaml } from "../context/readers.js";
import { agentConfigPath } from "../context/paths.js";
import { existsSync } from "node:fs";

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

// --- Helper: get agent routing rules from AGENT.yml ---

function getAgentRoutingRules(agentId: string): RoutingRule[] {
  const configPath = agentConfigPath(agentId);
  if (!existsSync(configPath)) return [];
  const raw = readYaml(configPath) as Record<string, unknown>;
  const routing = (raw["routing"] as { rules?: RoutingRule[] } | undefined);
  return routing?.rules ?? [];
}

// ── GET /settings/routing ───────────────────────────────────

routingRoutes.get("/settings/routing", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  return c.json(getRoutingConfig());
});

// ── PUT /settings/routing ───────────────────────────────────

routingRoutes.put("/settings/routing", async (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const body = await c.req.json<Partial<RoutingConfig>>();

  if (typeof body.enabled !== "boolean") {
    return c.json({ error: "'enabled' (boolean) is required" }, 400);
  }
  if (!Array.isArray(body.rules)) {
    return c.json({ error: "'rules' (array) is required" }, 400);
  }

  const config: RoutingConfig = {
    enabled: body.enabled,
    rules: body.rules,
  };

  setRoutingConfig(config);
  return c.json(getRoutingConfig());
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

  // Build to-date upper bound (inclusive of full day)
  const toEnd = `${to}T23:59:59.999Z`;
  const fromStart = `${from}T00:00:00.000Z`;

  // Query heartbeat_log
  const heartbeatRows = db
    .prepare(
      `SELECT model_used, routing_rule, COUNT(*) as cnt
       FROM heartbeat_log
       WHERE agent_id = ? AND ts >= ? AND ts <= ?
       GROUP BY model_used, routing_rule`
    )
    .all(agentId, fromStart, toEnd) as {
    model_used: string | null;
    routing_rule: string | null;
    cnt: number;
  }[];

  // Query cron_run_log
  const cronRows = db
    .prepare(
      `SELECT model_used, routing_rule, COUNT(*) as cnt
       FROM cron_run_log
       WHERE agent_id = ? AND ts >= ? AND ts <= ?
       GROUP BY model_used, routing_rule`
    )
    .all(agentId, fromStart, toEnd) as {
    model_used: string | null;
    routing_rule: string | null;
    cnt: number;
  }[];

  // Combine rows
  const allRows = [...heartbeatRows, ...cronRows];

  // Aggregate model distribution
  const modelCounts = new Map<string, number>();
  const ruleHits = new Map<string, number>();
  let totalExecutions = 0;

  for (const row of allRows) {
    totalExecutions += row.cnt;

    const model = row.model_used ?? "unknown";
    modelCounts.set(model, (modelCounts.get(model) ?? 0) + row.cnt);

    const rule = row.routing_rule ?? "fallback";
    ruleHits.set(rule, (ruleHits.get(rule) ?? 0) + row.cnt);
  }

  // Build model distribution
  const modelDistribution: Record<string, { count: number; pct: number }> = {};
  for (const [model, count] of modelCounts.entries()) {
    modelDistribution[model] = {
      count,
      pct: totalExecutions > 0 ? Math.round((count / totalExecutions) * 100) / 100 : 0,
    };
  }

  // Estimate savings: compare actual cost vs. cost without routing (fallback model)
  const agentRules = getAgentRoutingRules(agentId);
  const globalConfig = getRoutingConfig();

  // Fallback model: what resolveModelResult returns with no context
  const fallbackModel = resolveModelResult("heartbeat", undefined, agentRules).model;

  let withRoutingUsd = 0;
  let withoutRoutingUsd = 0;

  for (const [model, count] of modelCounts.entries()) {
    const m = model === "unknown" ? fallbackModel : model;
    withRoutingUsd += costUsd(count, m);
  }
  withoutRoutingUsd = costUsd(totalExecutions, fallbackModel);

  const savedUsd = withoutRoutingUsd - withRoutingUsd;
  const savedPct =
    withoutRoutingUsd > 0
      ? Math.round((savedUsd / withoutRoutingUsd) * 100) / 100
      : 0;

  // Build rule hits object
  const ruleHitsObj: Record<string, number> = {};
  for (const [rule, count] of ruleHits.entries()) {
    ruleHitsObj[rule] = count;
  }

  return c.json({
    agentId,
    period: { from, to },
    totalExecutions,
    modelDistribution,
    estimatedSavings: {
      without_routing_usd: Math.round(withoutRoutingUsd * 10000) / 10000,
      with_routing_usd: Math.round(withRoutingUsd * 10000) / 10000,
      saved_usd: Math.round(savedUsd * 10000) / 10000,
      saved_pct: savedPct,
    },
    ruleHits: ruleHitsObj,
    pricingNote: `Estimated using ${AVG_TOKENS_PER_EXECUTION} avg tokens/execution. Static pricing table.`,
    globalRoutingEnabled: globalConfig.enabled,
  });
});

// ── POST /settings/routing/simulate ────────────────────────

routingRoutes.post("/settings/routing/simulate", async (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const body = await c.req.json<{
    agentId?: string;
    mode?: string;
    estimatedPromptTokens?: number;
    toolsCount?: number;
    channelType?: string;
    tags?: string[];
    role?: string;
  }>();

  if (!body.mode) {
    return c.json({ error: "'mode' is required" }, 400);
  }

  const validModes = ["heartbeat", "conversation", "cron", "webhook"];
  if (!validModes.includes(body.mode)) {
    return c.json(
      { error: `'mode' must be one of: ${validModes.join(", ")}` },
      400
    );
  }

  const context: RoutingContext = {
    mode: body.mode as RoutingContext["mode"],
    estimatedPromptTokens: body.estimatedPromptTokens,
    toolsCount: body.toolsCount,
    channelType: body.channelType,
    tags: body.tags,
  };

  // Role to resolve: map mode to a role name
  const role = body.role ?? (body.mode === "heartbeat" ? "heartbeat" : "conversation");

  // Get agent-specific rules if agentId provided
  const agentRules = body.agentId ? getAgentRoutingRules(body.agentId) : [];

  const result = resolveModelResult(role, context, agentRules);

  return c.json({
    selectedModel: result.model,
    matchedRule: result.ruleName,
    fallback: result.ruleName === null,
  });
});
