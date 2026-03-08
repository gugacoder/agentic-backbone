import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { getBillingConfig, getMarkupOverride } from "./config.js";
import type { TenantBilling, TenantBillingDetail } from "./schemas.js";

interface RawHeartbeatRow {
  agent_id: string;
  model_used: string | null;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  invocations: number;
}

interface RawCronRow {
  agent_id: string;
  model_used: string | null;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  invocations: number;
}

interface RawConversationRow {
  agent_id: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  invocations: number;
}

interface DetailAccumulator {
  agentId: string;
  model: string;
  operationType: string;
  tokensInput: number;
  tokensOutput: number;
  costBase: number;
  invocations: number;
}

interface TenantAccumulator {
  tenantId: string;
  details: Map<string, DetailAccumulator>;
}

function monthDateRange(year: number, month: number): { from: string; to: string } {
  const fromDate = new Date(Date.UTC(year, month - 1, 1));
  const toDate = new Date(Date.UTC(year, month, 1));
  const from = fromDate.toISOString().slice(0, 10);
  const to = toDate.toISOString().slice(0, 10);
  return { from, to };
}

function tenantFromAgentId(agentId: string): string {
  return agentId.split(".")[0] ?? agentId;
}

function detailKey(agentId: string, model: string, operationType: string): string {
  return `${agentId}::${model}::${operationType}`;
}

export interface ConsolidationResult {
  tenantCount: number;
  billingIds: string[];
}

export function consolidateMonth(year: number, month: number): ConsolidationResult {
  const { from, to } = monthDateRange(year, month);
  const config = getBillingConfig();

  const tenants = new Map<string, TenantAccumulator>();

  function ensureTenant(tenantId: string): TenantAccumulator {
    if (!tenants.has(tenantId)) {
      tenants.set(tenantId, { tenantId, details: new Map() });
    }
    return tenants.get(tenantId)!;
  }

  function addDetail(
    tenant: TenantAccumulator,
    agentId: string,
    model: string,
    operationType: string,
    tokensIn: number,
    tokensOut: number,
    costUsd: number,
    invocations: number
  ): void {
    const key = detailKey(agentId, model, operationType);
    const existing = tenant.details.get(key);
    if (existing) {
      existing.tokensInput += tokensIn;
      existing.tokensOutput += tokensOut;
      existing.costBase += costUsd;
      existing.invocations += invocations;
    } else {
      tenant.details.set(key, {
        agentId,
        model,
        operationType,
        tokensInput: tokensIn,
        tokensOutput: tokensOut,
        costBase: costUsd,
        invocations,
      });
    }
  }

  // Aggregate heartbeat logs with model info
  const heartbeatRows = db.prepare(`
    SELECT
      agent_id,
      COALESCE(model_used, 'unknown') AS model_used,
      SUM(input_tokens) AS tokens_in,
      SUM(output_tokens) AS tokens_out,
      SUM(cost_usd) AS cost_usd,
      COUNT(*) AS invocations
    FROM heartbeat_log
    WHERE ts >= ? AND ts < ? AND status != 'skipped'
    GROUP BY agent_id, model_used
  `).all(from, to) as RawHeartbeatRow[];

  for (const row of heartbeatRows) {
    const tenantId = tenantFromAgentId(row.agent_id);
    const tenant = ensureTenant(tenantId);
    addDetail(tenant, row.agent_id, row.model_used ?? "unknown", "heartbeat", row.tokens_in, row.tokens_out, row.cost_usd, row.invocations);
  }

  // Aggregate cron logs with model info
  const cronRows = db.prepare(`
    SELECT
      agent_id,
      COALESCE(model_used, 'unknown') AS model_used,
      SUM(input_tokens) AS tokens_in,
      SUM(output_tokens) AS tokens_out,
      SUM(cost_usd) AS cost_usd,
      COUNT(*) AS invocations
    FROM cron_run_log
    WHERE ts >= ? AND ts < ? AND status = 'ok'
    GROUP BY agent_id, model_used
  `).all(from, to) as RawCronRow[];

  for (const row of cronRows) {
    const tenantId = tenantFromAgentId(row.agent_id);
    const tenant = ensureTenant(tenantId);
    addDetail(tenant, row.agent_id, row.model_used ?? "unknown", "cron", row.tokens_in, row.tokens_out, row.cost_usd, row.invocations);
  }

  // Aggregate conversation costs from cost_daily (no model info available)
  const convRows = db.prepare(`
    SELECT
      agent_id,
      SUM(tokens_in) AS tokens_in,
      SUM(tokens_out) AS tokens_out,
      SUM(cost_usd) AS cost_usd,
      SUM(calls) AS invocations
    FROM cost_daily
    WHERE date >= ? AND date < ? AND operation = 'conversation'
    GROUP BY agent_id
  `).all(from, to) as RawConversationRow[];

  for (const row of convRows) {
    const tenantId = tenantFromAgentId(row.agent_id);
    const tenant = ensureTenant(tenantId);
    addDetail(tenant, row.agent_id, "unknown", "conversation", row.tokens_in, row.tokens_out, row.cost_usd, row.invocations);
  }

  const billingIds: string[] = [];

  const upsertBilling = db.prepare(`
    INSERT INTO tenant_billing (id, tenant_id, period_year, period_month, tokens_input, tokens_output, tokens_total, cost_base, markup_pct, cost_with_markup, status)
    VALUES (@id, @tenantId, @year, @month, @tokensInput, @tokensOutput, @tokensTotal, @costBase, @markupPct, @costWithMarkup, 'draft')
    ON CONFLICT(tenant_id, period_year, period_month) DO UPDATE SET
      tokens_input = @tokensInput,
      tokens_output = @tokensOutput,
      tokens_total = @tokensTotal,
      cost_base = @costBase,
      markup_pct = @markupPct,
      cost_with_markup = @costWithMarkup
  `);

  const deleteBillingDetails = db.prepare(
    "DELETE FROM tenant_billing_detail WHERE billing_id = ?"
  );

  const insertDetail = db.prepare(`
    INSERT INTO tenant_billing_detail
      (id, billing_id, agent_id, agent_label, model, operation_type, tokens_input, tokens_output, tokens_total, cost_base, invocations)
    VALUES
      (@id, @billingId, @agentId, @agentLabel, @model, @operationType, @tokensInput, @tokensOutput, @tokensTotal, @costBase, @invocations)
  `);

  const consolidate = db.transaction(() => {
    for (const [, tenant] of tenants) {
      if (tenant.details.size === 0) continue;

      // Calculate totals
      let tokensInput = 0;
      let tokensOutput = 0;
      let costBase = 0;
      for (const detail of tenant.details.values()) {
        tokensInput += detail.tokensInput;
        tokensOutput += detail.tokensOutput;
        costBase += detail.costBase;
      }
      const tokensTotal = tokensInput + tokensOutput;

      // Markup: override > default
      const markupOverride = getMarkupOverride(tenant.tenantId);
      const markupPct = markupOverride !== null ? markupOverride : config.defaultMarkupPct;
      const costWithMarkup = costBase * (1 + markupPct);

      // Find or create billing row
      const existing = db.prepare(
        "SELECT id FROM tenant_billing WHERE tenant_id = ? AND period_year = ? AND period_month = ?"
      ).get(tenant.tenantId, year, month) as { id: string } | undefined;

      const billingId = existing?.id ?? randomUUID();

      upsertBilling.run({
        id: billingId,
        tenantId: tenant.tenantId,
        year,
        month,
        tokensInput,
        tokensOutput,
        tokensTotal,
        costBase,
        markupPct,
        costWithMarkup,
      });

      // Rebuild details
      deleteBillingDetails.run(billingId);

      for (const detail of tenant.details.values()) {
        insertDetail.run({
          id: randomUUID(),
          billingId,
          agentId: detail.agentId,
          agentLabel: detail.agentId,
          model: detail.model,
          operationType: detail.operationType,
          tokensInput: detail.tokensInput,
          tokensOutput: detail.tokensOutput,
          tokensTotal: detail.tokensInput + detail.tokensOutput,
          costBase: detail.costBase,
          invocations: detail.invocations,
        });
      }

      billingIds.push(billingId);
    }
  });

  consolidate();

  return { tenantCount: billingIds.length, billingIds };
}

export function getBillingForTenant(
  tenantId: string,
  year: number,
  month: number
): { billing: TenantBilling | null; details: TenantBillingDetail[] } {
  const billingRow = db.prepare(
    "SELECT * FROM tenant_billing WHERE tenant_id = ? AND period_year = ? AND period_month = ?"
  ).get(tenantId, year, month) as Record<string, unknown> | undefined;

  if (!billingRow) return { billing: null, details: [] };

  const billing: TenantBilling = {
    id: billingRow.id as string,
    tenantId: billingRow.tenant_id as string,
    periodYear: billingRow.period_year as number,
    periodMonth: billingRow.period_month as number,
    tokensInput: billingRow.tokens_input as number,
    tokensOutput: billingRow.tokens_output as number,
    tokensTotal: billingRow.tokens_total as number,
    costBase: billingRow.cost_base as number,
    markupPct: billingRow.markup_pct as number,
    costWithMarkup: billingRow.cost_with_markup as number,
    status: billingRow.status as "draft" | "finalized" | "exported",
    finalizedAt: billingRow.finalized_at as string | null,
    createdAt: billingRow.created_at as string,
  };

  const detailRows = db.prepare(
    "SELECT * FROM tenant_billing_detail WHERE billing_id = ?"
  ).all(billingRow.id as string) as Record<string, unknown>[];

  const details: TenantBillingDetail[] = detailRows.map((r) => ({
    id: r.id as string,
    billingId: r.billing_id as string,
    agentId: r.agent_id as string,
    agentLabel: r.agent_label as string,
    model: r.model as string,
    operationType: r.operation_type as string,
    tokensInput: r.tokens_input as number,
    tokensOutput: r.tokens_output as number,
    tokensTotal: r.tokens_total as number,
    costBase: r.cost_base as number,
    invocations: r.invocations as number,
  }));

  return { billing, details };
}

export function listTenantBillings(year: number, month: number): TenantBilling[] {
  const rows = db.prepare(
    "SELECT * FROM tenant_billing WHERE period_year = ? AND period_month = ? ORDER BY tenant_id"
  ).all(year, month) as Record<string, unknown>[];

  return rows.map((r) => ({
    id: r.id as string,
    tenantId: r.tenant_id as string,
    periodYear: r.period_year as number,
    periodMonth: r.period_month as number,
    tokensInput: r.tokens_input as number,
    tokensOutput: r.tokens_output as number,
    tokensTotal: r.tokens_total as number,
    costBase: r.cost_base as number,
    markupPct: r.markup_pct as number,
    costWithMarkup: r.cost_with_markup as number,
    status: r.status as "draft" | "finalized" | "exported",
    finalizedAt: r.finalized_at as string | null,
    createdAt: r.created_at as string,
  }));
}

export function finalizeBilling(tenantId: string, year: number, month: number): boolean {
  const result = db.prepare(`
    UPDATE tenant_billing
    SET status = 'finalized', finalized_at = datetime('now')
    WHERE tenant_id = ? AND period_year = ? AND period_month = ? AND status = 'draft'
  `).run(tenantId, year, month);
  return result.changes > 0;
}

export function getProfitability(months: number): Array<{
  year: number;
  month: number;
  totalCostBase: number;
  totalRevenue: number;
  totalProfit: number;
  marginPct: number;
  tenants: number;
}> {
  const rows = db.prepare(`
    SELECT
      period_year AS year,
      period_month AS month,
      SUM(cost_base) AS total_cost_base,
      SUM(cost_with_markup) AS total_revenue,
      COUNT(DISTINCT tenant_id) AS tenants
    FROM tenant_billing
    GROUP BY period_year, period_month
    ORDER BY period_year DESC, period_month DESC
    LIMIT ?
  `).all(months) as Array<{
    year: number;
    month: number;
    total_cost_base: number;
    total_revenue: number;
    tenants: number;
  }>;

  return rows.map((r) => ({
    year: r.year,
    month: r.month,
    totalCostBase: r.total_cost_base,
    totalRevenue: r.total_revenue,
    totalProfit: r.total_revenue - r.total_cost_base,
    marginPct: r.total_revenue > 0 ? (r.total_revenue - r.total_cost_base) / r.total_revenue : 0,
    tenants: r.tenants,
  }));
}
