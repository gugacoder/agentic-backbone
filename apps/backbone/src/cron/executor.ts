import { runAgent, type UsageData } from "../agent/index.js";
import { triggerManualHeartbeat } from "../heartbeat/index.js";
import { deliverToSystemChannel } from "../channels/system-channel.js";
import { assemblePrompt } from "../context/index.js";
import { composeAgentTools } from "../agent/tools.js";
import { logCronRun } from "./log.js";
import { collectAgentResult } from "../utils/agent-stream.js";
import type { CronJob } from "./types.js";
import { formatError } from "../utils/errors.js";
import { emitNotification } from "../notifications/index.js";

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

  process.env.AGENT_ID = job.agentId;
  const execution = (async () => {
    const result = await collectAgentResult(
      runAgent(assembled.userMessage, {
        role: "cron",
        tools: composeAgentTools(job.agentId, "cron"),
        system: assembled.system,
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
  });

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
