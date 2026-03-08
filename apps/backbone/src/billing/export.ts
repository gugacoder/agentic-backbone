import { getBillingForTenant } from "./consolidator.js";

const CSV_HEADER = "tenant,agente,modelo,operacao,tokens_input,tokens_output,tokens_total,custo_base,markup_pct,custo_final,invocacoes\n";

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportTenantCsv(tenantId: string, year: number, month: number): string | null {
  const { billing, details } = getBillingForTenant(tenantId, year, month);

  if (!billing) return null;

  const rows: string[] = [CSV_HEADER];

  for (const detail of details) {
    const costFinal = detail.costBase * (1 + billing.markupPct);
    const row = [
      escapeCsv(tenantId),
      escapeCsv(detail.agentLabel),
      escapeCsv(detail.model),
      escapeCsv(detail.operationType),
      escapeCsv(detail.tokensInput),
      escapeCsv(detail.tokensOutput),
      escapeCsv(detail.tokensTotal),
      escapeCsv(detail.costBase.toFixed(6)),
      escapeCsv(billing.markupPct.toFixed(4)),
      escapeCsv(costFinal.toFixed(6)),
      escapeCsv(detail.invocations),
    ].join(",");
    rows.push(row + "\n");
  }

  return rows.join("");
}
