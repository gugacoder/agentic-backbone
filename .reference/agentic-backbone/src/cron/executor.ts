import { runAgent, type UsageData } from "../agent/index.js";
import { triggerManualHeartbeat } from "../heartbeat/index.js";
import { deliverToSystemChannel } from "../channels/system-channel.js";
import { invokeService } from "../services/engine.js";
import { assembleRequestPrompt } from "../context/index.js";
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
    } else if (job.def.payload.kind === "service") {
      return await executeServicePayload(job, startMs);
    } else if (job.def.payload.kind === "request") {
      return await executeRequestPayload(job, startMs);
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

  process.env.AGENT_ID = job.agentId;

  let fullText = "";
  let usageData: UsageData | undefined;

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("cron job timeout")), EXECUTION_TIMEOUT_MS);
  });

  const { createAllTools } = await import("../agent/create-all-tools.js");
  const execution = (async () => {
    for await (const event of runAgent(prompt, { role: "cron", tools: await createAllTools(job.agentId) })) {
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

async function executeServicePayload(
  job: CronJob,
  startMs: number
): Promise<CronExecutionResult> {
  const payload = job.def.payload;
  if (payload.kind !== "service") {
    return { status: "error", error: "invalid payload kind", durationMs: 0 };
  }

  invokeService({
    slug: payload.service,
    agentId: job.agentId,
    input: payload.input,
  });

  const durationMs = Date.now() - startMs;
  const summary = `service invoked: ${payload.service}`;

  logCronRun({
    jobSlug: job.slug,
    agentId: job.agentId ?? "system",
    status: "ok",
    durationMs,
    summary,
  });

  return { status: "ok", summary, durationMs };
}

async function executeRequestPayload(
  job: CronJob,
  startMs: number
): Promise<CronExecutionResult> {
  const payload = job.def.payload;
  if (payload.kind !== "request") {
    return { status: "error", error: "invalid payload kind", durationMs: 0 };
  }
  const message = payload.input
    ? `[cron:${job.agentId}/${job.slug}] Execute com inputs: ${JSON.stringify(payload.input)}`
    : `[cron:${job.agentId}/${job.slug}] Execute o request agendado.`;

  const prompt = await assembleRequestPrompt(job.agentId, message, payload.service);

  process.env.AGENT_ID = job.agentId;

  let fullText = "";
  let usageData: UsageData | undefined;

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("cron request timeout")), EXECUTION_TIMEOUT_MS);
  });

  const { createAllTools: createAllTools2 } = await import("../agent/create-all-tools.js");
  const execution = (async () => {
    for await (const event of runAgent(prompt, { role: "request", tools: await createAllTools2(job.agentId) })) {
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
