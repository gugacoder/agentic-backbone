import { createCronScheduler, type CronScheduler } from "./scheduler.js";
import { executeCronJob } from "./executor.js";
import {
  scanCronJobs,
  scanAgentCronJobs,
  createCronJobFile,
  updateCronJobFile,
  deleteCronJobFile,
  loadAgentCronState,
  saveAgentCronState,
} from "./store.js";
import { computeNextRunAtMs } from "./schedule.js";
import { getCronRunHistory } from "./log.js";
import type { CronJob, CronJobCreate, CronJobPatch } from "./types.js";

let scheduler: CronScheduler | null = null;

// ── Public API ────────────────────────────────────────────

export function startCron(): void {
  if (scheduler) return;
  scheduler = createCronScheduler(executeCronJob);
  scheduler.start();

  const jobs = scheduler.getJobs();
  const enabled = jobs.filter((j) => j.def.enabled);
  console.log(`[cron] started (${enabled.length} job(s))`);
}

export function stopCron(): void {
  if (!scheduler) return;
  scheduler.stop();
  scheduler = null;
  console.log("[cron] stopped");
}

export function getCronStatus(): {
  enabled: boolean;
  jobCount: number;
  nextWakeAtMs: number | null;
} {
  if (!scheduler) return { enabled: false, jobCount: 0, nextWakeAtMs: null };
  const jobs = scheduler.getJobs();
  const enabled = jobs.filter((j) => j.def.enabled);

  let nextWake: number | null = null;
  for (const j of enabled) {
    if (j.state.nextRunAtMs != null) {
      if (nextWake === null || j.state.nextRunAtMs < nextWake) {
        nextWake = j.state.nextRunAtMs;
      }
    }
  }

  return { enabled: true, jobCount: enabled.length, nextWakeAtMs: nextWake };
}

export function listCronJobs(opts?: {
  agentId?: string;
  includeDisabled?: boolean;
}): CronJob[] {
  if (!scheduler) return [];
  let jobs = scheduler.getJobs();

  if (opts?.agentId) {
    jobs = jobs.filter((j) => j.agentId === opts.agentId);
  }
  if (!opts?.includeDisabled) {
    jobs = jobs.filter((j) => j.def.enabled);
  }

  return jobs;
}

export function getCronJob(agentId: string, slug: string): CronJob | null {
  if (!scheduler) return null;
  return (
    scheduler.getJobs().find((j) => j.agentId === agentId && j.slug === slug) ??
    null
  );
}

export async function addCronJob(input: CronJobCreate): Promise<CronJob> {
  const path = createCronJobFile(input.agentId, input.slug, input.def);
  const now = Date.now();
  const nextRunAtMs = input.def.enabled
    ? computeNextRunAtMs(input.def.schedule, now)
    : undefined;

  const job: CronJob = {
    slug: input.slug,
    agentId: input.agentId,
    path,
    def: input.def,
    state: { nextRunAtMs },
  };

  // Persist initial state
  const states = loadAgentCronState(input.agentId);
  states[input.slug] = job.state;
  saveAgentCronState(input.agentId, states);

  // Reload scheduler to pick up new job
  if (scheduler) scheduler.reload();

  return job;
}

export async function updateCronJob(
  agentId: string,
  slug: string,
  patch: CronJobPatch
): Promise<CronJob> {
  const job = getCronJob(agentId, slug);
  if (!job) throw new Error(`cron job not found: ${agentId}/${slug}`);

  updateCronJobFile(job.path, patch);

  // Reload scheduler to pick up changes
  if (scheduler) scheduler.reload();

  return getCronJob(agentId, slug) ?? job;
}

export async function removeCronJob(
  agentId: string,
  slug: string
): Promise<boolean> {
  const job = getCronJob(agentId, slug);
  if (!job) return false;

  deleteCronJobFile(job.path);

  // Clean state
  const states = loadAgentCronState(agentId);
  delete states[slug];
  saveAgentCronState(agentId, states);

  // Reload scheduler
  if (scheduler) scheduler.reload();

  return true;
}

export async function runCronJob(
  agentId: string,
  slug: string,
  mode?: "due" | "force"
): Promise<{ ok: boolean; ran: boolean; reason?: string }> {
  if (!scheduler) return { ok: false, ran: false, reason: "cron not started" };

  const job = getCronJob(agentId, slug);
  if (!job) return { ok: false, ran: false, reason: "job not found" };

  if (mode !== "force") {
    if (!job.def.enabled)
      return { ok: true, ran: false, reason: "job disabled" };
    if (job.state.runningAtMs)
      return { ok: true, ran: false, reason: "already running" };
    if (job.state.nextRunAtMs && Date.now() < job.state.nextRunAtMs)
      return { ok: true, ran: false, reason: "not due yet" };
  }

  const result = await executeCronJob(job);
  scheduler.reload();

  return {
    ok: result.status === "ok",
    ran: true,
    reason: result.error,
  };
}

export function reloadCron(): void {
  if (scheduler) scheduler.reload();
}

export { getCronRunHistory } from "./log.js";
