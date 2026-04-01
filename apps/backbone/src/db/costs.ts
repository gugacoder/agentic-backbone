import { db } from "./index.js";
import { insertNotification } from "../routes/notifications.js";

export interface TrackCostParams {
  agentId: string;
  operation: "heartbeat" | "conversation" | "cron";
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

const upsertStmt = db.prepare(`
  INSERT INTO cost_daily (date, agent_id, operation, tokens_in, tokens_out, cost_usd, calls)
  VALUES (date('now'), @agentId, @operation, @tokensIn, @tokensOut, @costUsd, 1)
  ON CONFLICT(date, agent_id, operation) DO UPDATE SET
    tokens_in  = tokens_in  + @tokensIn,
    tokens_out = tokens_out + @tokensOut,
    cost_usd   = cost_usd   + @costUsd,
    calls      = calls      + 1
`);

export function trackCost(params: TrackCostParams): void {
  upsertStmt.run({
    agentId: params.agentId,
    operation: params.operation,
    tokensIn: params.tokensIn,
    tokensOut: params.tokensOut,
    costUsd: params.costUsd,
  });
  checkBudgetAlerts(params.agentId);
}

function checkBudgetAlerts(agentId: string): void {
  const alerts = db
    .prepare("SELECT * FROM budget_alerts WHERE enabled = 1")
    .all() as Array<Record<string, unknown>>;

  if (alerts.length === 0) return;

  const today = new Date().toISOString().slice(0, 10);

  for (const alert of alerts) {
    const scope = alert.scope as string;
    const threshold = alert.threshold as number;
    const period = alert.period as string;

    if (scope !== "global" && scope !== agentId) continue;

    const from = getPeriodStart(today, period);
    const scopeFilter = scope === "global" ? "" : " AND agent_id = ?";
    const params: unknown[] = [from, today];
    if (scope !== "global") params.push(scope);

    const row = db
      .prepare(
        `SELECT COALESCE(SUM(cost_usd), 0) AS total
         FROM cost_daily
         WHERE date >= ? AND date <= ?${scopeFilter}`,
      )
      .get(...params) as { total: number };

    if (row.total >= threshold) {
      const scopeLabel = scope === "global" ? "Global" : scope;
      insertNotification({
        type: "budget_exceeded",
        severity: "warning",
        agentId: scope === "global" ? undefined : scope,
        title: `Alerta de orcamento excedido`,
        body: `${scopeLabel}: $${row.total.toFixed(2)} de $${threshold.toFixed(2)} (${periodLabel(period)})`,
        metadata: {
          alertId: alert.id,
          scope,
          threshold,
          actual: row.total,
          period,
        },
      });
    }
  }
}

function getPeriodStart(today: string, period: string): string {
  const d = new Date(today + "T00:00:00Z");
  switch (period) {
    case "weekly": {
      const day = d.getUTCDay();
      d.setUTCDate(d.getUTCDate() - day);
      break;
    }
    case "monthly":
      d.setUTCDate(1);
      break;
  }
  return d.toISOString().slice(0, 10);
}

function periodLabel(period: string): string {
  switch (period) {
    case "daily":
      return "diario";
    case "weekly":
      return "semanal";
    case "monthly":
      return "mensal";
    default:
      return period;
  }
}
