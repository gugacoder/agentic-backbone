import { db } from "../db/index.js";
import type { BillingConfig, BillingConfigUpdate } from "./schemas.js";

type DbRow = {
  id: string;
  currency: string;
  default_markup_pct: number;
  agency_name: string | null;
  agency_document: string | null;
  agency_address: string | null;
  agency_bank_info: string | null;
  agency_logo_url: string | null;
  invoice_footer: string | null;
  updated_at: string;
};

function rowToConfig(row: DbRow): BillingConfig {
  return {
    id: row.id,
    currency: row.currency,
    defaultMarkupPct: row.default_markup_pct,
    agencyName: row.agency_name,
    agencyDocument: row.agency_document,
    agencyAddress: row.agency_address,
    agencyBankInfo: row.agency_bank_info,
    agencyLogoUrl: row.agency_logo_url,
    invoiceFooter: row.invoice_footer,
    updatedAt: row.updated_at,
  };
}

export function getBillingConfig(): BillingConfig {
  const row = db
    .prepare("SELECT * FROM billing_config WHERE id = 'default'")
    .get() as DbRow | undefined;

  if (!row) {
    // Insert default row if missing
    db.prepare(`
      INSERT OR IGNORE INTO billing_config (id, currency, default_markup_pct)
      VALUES ('default', 'BRL', 0.0)
    `).run();
    return getBillingConfig();
  }

  return rowToConfig(row);
}

export function updateBillingConfig(update: BillingConfigUpdate): BillingConfig {
  const current = getBillingConfig();

  const merged = {
    currency: update.currency ?? current.currency,
    defaultMarkupPct: update.defaultMarkupPct ?? current.defaultMarkupPct,
    agencyName: update.agencyName !== undefined ? update.agencyName : current.agencyName,
    agencyDocument: update.agencyDocument !== undefined ? update.agencyDocument : current.agencyDocument,
    agencyAddress: update.agencyAddress !== undefined ? update.agencyAddress : current.agencyAddress,
    agencyBankInfo: update.agencyBankInfo !== undefined ? update.agencyBankInfo : current.agencyBankInfo,
    agencyLogoUrl: update.agencyLogoUrl !== undefined ? update.agencyLogoUrl : current.agencyLogoUrl,
    invoiceFooter: update.invoiceFooter !== undefined ? update.invoiceFooter : current.invoiceFooter,
  };

  db.prepare(`
    UPDATE billing_config SET
      currency = @currency,
      default_markup_pct = @defaultMarkupPct,
      agency_name = @agencyName,
      agency_document = @agencyDocument,
      agency_address = @agencyAddress,
      agency_bank_info = @agencyBankInfo,
      agency_logo_url = @agencyLogoUrl,
      invoice_footer = @invoiceFooter,
      updated_at = datetime('now')
    WHERE id = 'default'
  `).run(merged);

  return getBillingConfig();
}

export function getMarkupOverride(tenantId: string): number | null {
  const row = db
    .prepare("SELECT markup_pct FROM tenant_markup_override WHERE tenant_id = ?")
    .get(tenantId) as { markup_pct: number } | undefined;
  return row?.markup_pct ?? null;
}

export function setMarkupOverride(tenantId: string, markupPct: number): void {
  db.prepare(`
    INSERT INTO tenant_markup_override (tenant_id, markup_pct, updated_at)
    VALUES (@tenantId, @markupPct, datetime('now'))
    ON CONFLICT(tenant_id) DO UPDATE SET
      markup_pct = @markupPct,
      updated_at = datetime('now')
  `).run({ tenantId, markupPct });
}

export function getAllMarkupOverrides(): Array<{ tenantId: string; markupPct: number; updatedAt: string }> {
  return (db.prepare("SELECT * FROM tenant_markup_override").all() as Array<{
    tenant_id: string;
    markup_pct: number;
    updated_at: string;
  }>).map((r) => ({ tenantId: r.tenant_id, markupPct: r.markup_pct, updatedAt: r.updated_at }));
}
