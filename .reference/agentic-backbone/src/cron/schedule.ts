import { Cron } from "croner";
import type { CronSchedule } from "./types.js";

export function parseAbsoluteTimeMs(input: string): number | null {
  const ms = Date.parse(input);
  return Number.isNaN(ms) ? null : ms;
}

export function computeNextRunAtMs(
  schedule: CronSchedule,
  nowMs: number
): number | undefined {
  switch (schedule.kind) {
    case "at": {
      const ms = parseAbsoluteTimeMs(schedule.at);
      if (ms === null) return undefined;
      return ms > nowMs ? ms : undefined;
    }

    case "every": {
      const anchor = schedule.anchorMs ?? nowMs;
      if (schedule.everyMs <= 0) return undefined;
      const elapsed = nowMs - anchor;
      const periods = Math.ceil(elapsed / schedule.everyMs);
      const next = anchor + periods * schedule.everyMs;
      return next <= nowMs ? next + schedule.everyMs : next;
    }

    case "cron": {
      try {
        const cron = new Cron(schedule.expr, {
          timezone: schedule.tz,
        });
        const nextDate = cron.nextRun(new Date(nowMs));
        if (!nextDate) return undefined;
        // Floor to second for cron expressions (no sub-second precision)
        return Math.floor(nextDate.getTime() / 1000) * 1000;
      } catch {
        return undefined;
      }
    }

    default:
      return undefined;
  }
}
