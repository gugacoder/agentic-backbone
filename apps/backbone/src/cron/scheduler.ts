import { computeNextRunAtMs } from "./schedule.js";
import { scanCronJobs, loadAgentCronState, saveAgentCronState } from "./store.js";
import { eventBus } from "../events/index.js";
import type { CronJob, CronJobState } from "./types.js";
import type { CronExecutionResult } from "./executor.js";

const MAX_TIMER_DELAY_MS = 60_000;
const ERROR_BACKOFF_SCHEDULE_MS = [30_000, 60_000, 300_000, 900_000, 3_600_000];
const STUCK_RUN_MS = 2 * 60 * 60 * 1000;

export interface CronScheduler {
  start(): void;
  stop(): void;
  reload(): void;
  getJobs(): CronJob[];
  flushState(): void;
}

export function createCronScheduler(
  onExecute: (job: CronJob) => Promise<CronExecutionResult>
): CronScheduler {
  let jobs: CronJob[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;

  function loadJobs(): void {
    jobs = scanCronJobs();
    const now = Date.now();

    for (const job of jobs) {
      // Clear stuck runs
      if (job.state.runningAtMs && now - job.state.runningAtMs > STUCK_RUN_MS) {
        job.state.runningAtMs = undefined;
        job.state.lastStatus = "error";
        job.state.lastError = "stuck (cleared)";
      }

      // Recompute nextRunAtMs if missing
      if (job.state.nextRunAtMs == null && job.def.enabled) {
        job.state.nextRunAtMs = computeNextRunAtMs(job.def.schedule, now);
      }
    }
  }

  function flushState(): void {
    const byAgent = new Map<string, Record<string, CronJobState>>();

    for (const job of jobs) {
      if (!byAgent.has(job.agentId)) {
        byAgent.set(job.agentId, {});
      }
      byAgent.get(job.agentId)![job.slug] = job.state;
    }

    for (const [agentId, states] of byAgent) {
      saveAgentCronState(agentId, states);
    }
  }

  function findDueJobs(now: number): CronJob[] {
    return jobs.filter(
      (j) =>
        j.def.enabled &&
        !j.state.runningAtMs &&
        j.state.nextRunAtMs != null &&
        now >= j.state.nextRunAtMs
    );
  }

  function applyBackoff(job: CronJob): void {
    const errors = (job.state.consecutiveErrors ?? 0);
    const idx = Math.min(errors, ERROR_BACKOFF_SCHEDULE_MS.length - 1);
    const backoffMs = ERROR_BACKOFF_SCHEDULE_MS[idx];
    job.state.nextRunAtMs = Date.now() + backoffMs;
  }

  async function executeDueJobs(): Promise<void> {
    const now = Date.now();
    const due = findDueJobs(now);

    for (const job of due) {
      job.state.runningAtMs = Date.now();

      eventBus.emit("cron:job", {
        ts: Date.now(),
        jobSlug: job.slug,
        agentId: job.agentId,
        action: "started",
      });

      try {
        const result = await onExecute(job);
        const finishedAt = Date.now();

        job.state.runningAtMs = undefined;
        job.state.lastRunAtMs = finishedAt;
        job.state.lastDurationMs = result.durationMs;
        job.state.lastStatus = result.status;
        job.state.lastError = result.error;

        if (result.status === "ok") {
          job.state.consecutiveErrors = 0;
        } else {
          job.state.consecutiveErrors = (job.state.consecutiveErrors ?? 0) + 1;
          applyBackoff(job);
        }

        // Handle one-shot jobs
        if (result.status === "ok" && job.def.schedule.kind === "at") {
          if (job.def.deleteAfterRun !== false) {
            job.def.enabled = false;
            job.state.nextRunAtMs = undefined;
          }
        }

        // Recompute next run (unless backoff already set it)
        if (result.status === "ok" || job.state.nextRunAtMs == null) {
          job.state.nextRunAtMs = computeNextRunAtMs(job.def.schedule, finishedAt);
        }

        eventBus.emit("cron:job", {
          ts: finishedAt,
          jobSlug: job.slug,
          agentId: job.agentId,
          action: "finished",
          status: result.status,
          durationMs: result.durationMs,
          nextRunAtMs: job.state.nextRunAtMs,
          error: result.error,
          summary: result.summary,
        });
      } catch (err) {
        job.state.runningAtMs = undefined;
        job.state.lastStatus = "error";
        job.state.lastError = err instanceof Error ? err.message : String(err);
        job.state.consecutiveErrors = (job.state.consecutiveErrors ?? 0) + 1;
        applyBackoff(job);

        eventBus.emit("cron:job", {
          ts: Date.now(),
          jobSlug: job.slug,
          agentId: job.agentId,
          action: "finished",
          status: "error",
          error: job.state.lastError,
        });
      }
    }

    if (due.length > 0) {
      flushState();
    }
  }

  function getNextWakeMs(): number {
    const now = Date.now();
    let earliest = Infinity;

    for (const job of jobs) {
      if (
        job.def.enabled &&
        !job.state.runningAtMs &&
        job.state.nextRunAtMs != null
      ) {
        const delta = job.state.nextRunAtMs - now;
        if (delta < earliest) earliest = delta;
      }
    }

    if (earliest === Infinity) return MAX_TIMER_DELAY_MS;
    return Math.max(0, Math.min(earliest, MAX_TIMER_DELAY_MS));
  }

  function armTimer(): void {
    if (!running) return;
    if (timer) clearTimeout(timer);

    const delay = getNextWakeMs();
    timer = setTimeout(onTimer, delay);
  }

  async function onTimer(): Promise<void> {
    if (!running) return;
    try {
      await executeDueJobs();
    } catch (err) {
      console.error("[cron] timer error:", err);
    }
    armTimer();
  }

  return {
    start() {
      if (running) return;
      running = true;
      loadJobs();
      flushState();
      armTimer();
    },

    stop() {
      running = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      flushState();
    },

    reload() {
      loadJobs();
      flushState();
      if (running) armTimer();
    },

    getJobs() {
      return [...jobs];
    },

    flushState,
  };
}
