import { db } from "../db/index.js";
import { eventBus } from "../events/index.js";

const WINDOW_MINUTES = 60;
const THRESHOLD = 5;
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

const selectHighCriticalByAgent = db.prepare(`
  SELECT agent_id, COUNT(*) as event_count
  FROM security_events
  WHERE severity IN ('high', 'critical')
    AND created_at >= datetime('now', '-${WINDOW_MINUTES} minutes')
  GROUP BY agent_id
  HAVING COUNT(*) > ${THRESHOLD}
`);

let intervalHandle: ReturnType<typeof setInterval> | null = null;

function runCheck(): void {
  try {
    const rows = selectHighCriticalByAgent.all() as { agent_id: string; event_count: number }[];
    for (const row of rows) {
      eventBus.emit("security:alert", {
        ts: Date.now(),
        agentId: row.agent_id,
        eventCount: row.event_count,
        windowMinutes: WINDOW_MINUTES,
      });
      console.warn(
        `[security] anomaly detected: agent=${row.agent_id} events=${row.event_count} in last ${WINDOW_MINUTES}min`
      );
    }
  } catch (err) {
    console.error("[security] anomaly check failed:", err);
  }
}

export function startSecurityAnomalyJob(): void {
  if (intervalHandle) return;
  intervalHandle = setInterval(runCheck, CHECK_INTERVAL_MS);
  // Run immediately on startup to detect existing anomalies
  runCheck();
}

export function stopSecurityAnomalyJob(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
