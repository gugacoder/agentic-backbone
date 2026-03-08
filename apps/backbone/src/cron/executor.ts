import { type UsageData, type RoutingContext, type RoutingRule, type ModelResult } from "../agent/index.js";
import { instrumentedRunAgent } from "../telemetry/instrumentor.js";
import { triggerManualHeartbeat } from "../heartbeat/index.js";
import { deliverToSystemChannel } from "../channels/system-channel.js";
import { assemblePrompt } from "../context/index.js";
import { composeAgentTools } from "../agent/tools.js";
import { logCronRun } from "./log.js";
import { collectAgentResult } from "../utils/agent-stream.js";
import type { CronJob } from "./types.js";
import { formatError } from "../utils/errors.js";
import { emitNotification } from "../notifications/index.js";
import { trackCost } from "../db/costs.js";
import { trackCron } from "../db/analytics.js";
import { estimateTokens } from "../settings/llm.js";
import { getAgent } from "../agents/registry.js";
import { circuitBreaker } from "../circuit-breaker/index.js";

const EXECUTION_TIMEOUT_MS = 10 * 60 * 1000;

export interface CronExecutionResult {
  status: "ok" | "error" | "skipped";
  summary?: string;
  error?: string;
  usage?: UsageData;
  durationMs: number;
}

export async function executeCronJob(job: CronJob): Promise<CronExecutionResult> {
  const startMs = Date.now();

  // Guard: circuit-breaker
  const cbCheck = circuitBreaker.canExecute(job.agentId);
  if (!cbCheck.allowed) {
    circuitBreaker.recordBlocked(job.agentId, cbCheck.reason ?? "unknown", {
      mode: "cron",
      jobSlug: job.slug,
    });
    return { status: "skipped", error: `circuit-breaker: ${cbCheck.reason}`, durationMs: 0 };
  }

  try {
    if (job.def.payload.kind === "heartbeat") {
      return await executeHeartbeatPayload(job, startMs);
    } else {
      return await executeMessagePayload(job, startMs);
    }
  } catch (err) {
    const durationMs = Date.now() - startMs;
    const error = formatError(err);

    logCronRun({
      jobSlug: job.slug,
      agentId: job.agentId,
      status: "error",
      durationMs,
      error,
    });

    emitNotification({
      type: "cron_error",
      severity: "error",
      agentId: job.agentId,
      title: `Cron job falhou: ${job.agentId}/${job.slug}`,
      body: error,
      metadata: { jobSlug: job.slug, durationMs },
    });

    trackCron({ agentId: job.agentId, status: "error", durationMs });
    circuitBreaker.recordOutcome(job.agentId, false);
    return { status: "error", error, durationMs };
  }
}

async function executeHeartbeatPayload(
  job: CronJob,
  startMs: number
): Promise<CronExecutionResult> {
  await triggerManualHeartbeat(job.agentId);

  const durationMs = Date.now() - startMs;

  logCronRun({
    jobSlug: job.slug,
    agentId: job.agentId,
    status: "ok",
    durationMs,
    summary: "heartbeat triggered",
  });

  return { status: "ok", summary: "heartbeat triggered", durationMs };
}

async function executeMessagePayload(
  job: CronJob,
  startMs: number
): Promise<CronExecutionResult> {
  const payload = job.def.payload;
  if (payload.kind === "heartbeat") {
    return { status: "error", error: "invalid payload kind", durationMs: 0 };
  }

  const mode = payload.kind;
  const userMessage = `[cron:${job.agentId}/${job.slug}] ${payload.message}`;
  const assembled = await assemblePrompt(job.agentId, mode, { userMessage });
  if (!assembled) {
    const durationMs = Date.now() - startMs;
    logCronRun({
      jobSlug: job.slug,
      agentId: job.agentId,
      status: "skipped",
      durationMs,
      error: `no ${mode} instructions`,
    });
    return { status: "skipped", error: `no ${mode} instructions`, durationMs };
  }

  let fullText = "";
  let usageData: UsageData | undefined;

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("cron job timeout")), EXECUTION_TIMEOUT_MS);
  });

  const tools = composeAgentTools(job.agentId, "cron");
  const routingCtx: RoutingContext = {
    mode: "cron",
    estimatedPromptTokens: estimateTokens((assembled.system ?? "") + assembled.userMessage),
    toolsCount: tools ? Object.keys(tools).length : 0,
  };
  const agentConfig = getAgent(job.agentId);
  const agentRules = ((agentConfig?.metadata as Record<string, unknown> | undefined)?.["routing"] as { rules?: RoutingRule[] } | undefined)?.rules;

  let routingResult: ModelResult | undefined;

  process.env.AGENT_ID = job.agentId;
  const execution = (async () => {
    const result = await collectAgentResult(
      instrumentedRunAgent(job.agentId, "cron", assembled.userMessage, {
        role: "cron",
        tools,
        system: assembled.system,
        routingContext: routingCtx,
        agentRoutingRules: agentRules,
        onRoutingResolved: (r) => { routingResult = r; },
        cronJobId: job.slug,
        cronSchedule: JSON.stringify(job.def.schedule),
      })
    );
    fullText = result.fullText;
    usageData = result.usage;
  })();

  await Promise.race([execution, timeout]);

  const durationMs = Date.now() - startMs;
  const summary = fullText.slice(0, 200) || undefined;

  if (fullText.trim()) {
    deliverToSystemChannel(job.agentId, fullText);
  }

  logCronRun({
    jobSlug: job.slug,
    agentId: job.agentId,
    status: "ok",
    durationMs,
    summary,
    inputTokens: usageData?.inputTokens,
    outputTokens: usageData?.outputTokens,
    costUsd: usageData?.totalCostUsd,
    modelUsed: routingResult?.model,
    routingRule: routingResult?.ruleName ?? undefined,
  });

  if (usageData) {
    trackCost({
      agentId: job.agentId,
      operation: "cron",
      tokensIn: usageData.inputTokens,
      tokensOut: usageData.outputTokens,
      costUsd: usageData.totalCostUsd,
    });
  }

  trackCron({ agentId: job.agentId, status: "ok", durationMs });
  circuitBreaker.recordOutcome(job.agentId, true);

  emitNotification({
    type: "cron_ok",
    severity: "info",
    agentId: job.agentId,
    title: `Cron job concluido: ${job.agentId}/${job.slug}`,
    body: summary,
    metadata: { jobSlug: job.slug, durationMs },
  });

  return { status: "ok", summary, usage: usageData, durationMs };
}
