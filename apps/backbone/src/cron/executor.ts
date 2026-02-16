import { runAgent, type UsageData } from "../agent/index.js";
import { triggerManualHeartbeat } from "../heartbeat/index.js";
import { deliverToSystemChannel } from "../channels/system-channel.js";
import { logCronRun } from "./log.js";
import type { CronJob } from "./types.js";

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
      return await executeAgentTurnPayload(job, startMs);
    }
  } catch (err) {
    const durationMs = Date.now() - startMs;
    const error = err instanceof Error ? err.message : String(err);

    logCronRun({
      jobSlug: job.slug,
      agentId: job.agentId,
      status: "error",
      durationMs,
      error,
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

async function executeAgentTurnPayload(
  job: CronJob,
  startMs: number
): Promise<CronExecutionResult> {
  const payload = job.def.payload;
  if (payload.kind !== "agentTurn") {
    return { status: "error", error: "invalid payload kind", durationMs: 0 };
  }

  const prompt = `[cron:${job.agentId}/${job.slug}] ${payload.message}`;

  let fullText = "";
  let usageData: UsageData | undefined;

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("cron job timeout")), EXECUTION_TIMEOUT_MS);
  });

  const execution = (async () => {
    for await (const event of runAgent(prompt, { role: "cron" })) {
      if (event.type === "result" && event.content) {
        fullText = event.content;
      } else if (event.type === "text" && event.content) {
        fullText += event.content;
      } else if (event.type === "usage" && event.usage) {
        usageData = event.usage;
      }
    }
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

  return { status: "ok", summary, usage: usageData, durationMs };
}
