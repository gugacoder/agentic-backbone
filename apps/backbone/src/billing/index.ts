import { consolidateMonth, type ConsolidationResult } from "./consolidator.js";

export { getBillingConfig, updateBillingConfig, getMarkupOverride, setMarkupOverride, getAllMarkupOverrides } from "./config.js";
export { consolidateMonth, getBillingForTenant, listTenantBillings, finalizeBilling, getProfitability } from "./consolidator.js";
export { generateInvoice } from "./invoice.js";
export { exportTenantCsv } from "./export.js";
export type {
  BillingConfig,
  BillingConfigUpdate,
  TenantBilling,
  TenantBillingDetail,
  TenantMarkupOverride,
  ConsolidateParams,
  Invoice,
  InvoiceItem,
} from "./schemas.js";

// ── Internal cron: consolidate on day 1 of each month at 02:00 ────────────

let _cronTimer: ReturnType<typeof setTimeout> | null = null;

function getMsUntilNextConsolidation(): number {
  const now = new Date();

  // Next day-1 02:00 UTC
  let next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 2, 0, 0, 0));

  // If we haven't passed this month's day-1 02:00 yet, use it
  const thisMonthTarget = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 2, 0, 0, 0));
  if (thisMonthTarget > now) {
    next = thisMonthTarget;
  }

  return next.getTime() - now.getTime();
}

function scheduleNextConsolidation(): void {
  if (_cronTimer) clearTimeout(_cronTimer);

  const delayMs = getMsUntilNextConsolidation();

  _cronTimer = setTimeout(() => {
    const now = new Date();
    // Consolidate previous month
    const prevMonth = now.getUTCMonth() === 0 ? 12 : now.getUTCMonth();
    const prevYear = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();

    try {
      const result: ConsolidationResult = consolidateMonth(prevYear, prevMonth);
      console.log(
        `[billing] auto-consolidation done: ${result.tenantCount} tenant(s) for ${prevYear}-${String(prevMonth).padStart(2, "0")}`
      );
    } catch (err) {
      console.error("[billing] auto-consolidation failed:", err);
    }

    // Schedule next
    scheduleNextConsolidation();
  }, delayMs);

  // Allow Node to exit even if this timer is pending
  if (_cronTimer.unref) _cronTimer.unref();

  const nextDate = new Date(Date.now() + delayMs);
  console.log(`[billing] auto-consolidation scheduled for ${nextDate.toISOString()}`);
}

export function initBilling(): void {
  scheduleNextConsolidation();
}

export function stopBilling(): void {
  if (_cronTimer) {
    clearTimeout(_cronTimer);
    _cronTimer = null;
  }
}
