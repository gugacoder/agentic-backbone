import { getBillingConfig } from "./config.js";
import { getBillingForTenant } from "./consolidator.js";
import type { Invoice, InvoiceItem } from "./schemas.js";

export function generateInvoice(tenantId: string, year: number, month: number): Invoice | null {
  const { billing, details } = getBillingForTenant(tenantId, year, month);

  if (!billing) return null;

  const config = getBillingConfig();

  const invoiceNumber = `${String(year)}${String(month).padStart(2, "0")}-${tenantId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;

  const items: InvoiceItem[] = details.map((d) => ({
    agentLabel: d.agentLabel,
    model: d.model,
    operationType: d.operationType,
    tokensTotal: d.tokensTotal,
    costBase: d.costBase,
    costWithMarkup: d.costBase * (1 + billing.markupPct),
    invocations: d.invocations,
  }));

  const invoice: Invoice = {
    invoiceNumber,
    period: { year, month },
    agency: {
      name: config.agencyName ?? null,
      document: config.agencyDocument ?? null,
      address: config.agencyAddress ?? null,
      bankInfo: config.agencyBankInfo ?? null,
      logoUrl: config.agencyLogoUrl ?? null,
    },
    tenant: {
      id: tenantId,
      name: tenantId,
    },
    items,
    totals: {
      tokensTotal: billing.tokensTotal,
      costBase: billing.costBase,
      markupPct: billing.markupPct,
      costWithMarkup: billing.costWithMarkup,
    },
    footer: config.invoiceFooter ?? null,
    generatedAt: new Date().toISOString(),
  };

  return invoice;
}
