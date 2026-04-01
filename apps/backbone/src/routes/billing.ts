import { Hono } from "hono";
import { z } from "zod";
import { requireSysuser } from "./auth-helpers.js";
import {
  getBillingConfig,
  updateBillingConfig,
  getMarkupOverride,
  setMarkupOverride,
} from "../billing/index.js";
import {
  consolidateMonth,
  listTenantBillings,
  getBillingForTenant,
  finalizeBilling,
  getProfitability,
} from "../billing/index.js";
import { generateInvoice } from "../billing/index.js";
import { exportTenantCsv } from "../billing/index.js";
import { BillingConfigUpdateSchema } from "../billing/schemas.js";

export const billingRoutes = new Hono();

// ── GET /billing/config ──────────────────────────────────────────────────────

billingRoutes.get("/billing/config", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  return c.json(getBillingConfig());
});

// ── PUT /billing/config ──────────────────────────────────────────────────────

billingRoutes.put("/billing/config", async (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "JSON inválido" }, 400);
  }

  const result = BillingConfigUpdateSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: "Dados inválidos", details: result.error.flatten() }, 400);
  }

  const config = updateBillingConfig(result.data);
  return c.json(config);
});

// ── GET /billing/tenants (?year, ?month) ─────────────────────────────────────

billingRoutes.get("/billing/tenants", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const now = new Date();
  const yearStr = c.req.query("year");
  const monthStr = c.req.query("month");

  const year = yearStr ? parseInt(yearStr, 10) : now.getUTCFullYear();
  const month = monthStr ? parseInt(monthStr, 10) : now.getUTCMonth() + 1;

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return c.json({ error: "year/month inválidos" }, 400);
  }

  const tenants = listTenantBillings(year, month);
  return c.json({ year, month, tenants });
});

// ── GET /billing/tenants/:tenantId ───────────────────────────────────────────

billingRoutes.get("/billing/tenants/:tenantId", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const tenantId = c.req.param("tenantId");
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  const { billing, details } = getBillingForTenant(tenantId, year, month);

  if (!billing) {
    return c.json({ tenantId, billing: null, details: [] });
  }

  return c.json({ tenantId, billing, details });
});

// ── GET /billing/tenants/:tenantId/months/:year/:month ───────────────────────

billingRoutes.get("/billing/tenants/:tenantId/months/:year/:month", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const tenantId = c.req.param("tenantId");
  const year = parseInt(c.req.param("year"), 10);
  const month = parseInt(c.req.param("month"), 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return c.json({ error: "year/month inválidos" }, 400);
  }

  const { billing, details } = getBillingForTenant(tenantId, year, month);

  if (!billing) {
    return c.json({ error: "Billing não encontrado para o período" }, 404);
  }

  return c.json({ billing, details });
});

// ── POST /billing/tenants/:tenantId/months/:year/:month/finalize ─────────────

billingRoutes.post("/billing/tenants/:tenantId/months/:year/:month/finalize", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const tenantId = c.req.param("tenantId");
  const year = parseInt(c.req.param("year"), 10);
  const month = parseInt(c.req.param("month"), 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return c.json({ error: "year/month inválidos" }, 400);
  }

  const changed = finalizeBilling(tenantId, year, month);

  if (!changed) {
    return c.json({ error: "Billing não encontrado ou já finalizado" }, 404);
  }

  const { billing } = getBillingForTenant(tenantId, year, month);
  return c.json({ ok: true, billing });
});

// ── GET /billing/tenants/:tenantId/invoice/:year/:month ──────────────────────

billingRoutes.get("/billing/tenants/:tenantId/invoice/:year/:month", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const tenantId = c.req.param("tenantId");
  const year = parseInt(c.req.param("year"), 10);
  const month = parseInt(c.req.param("month"), 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return c.json({ error: "year/month inválidos" }, 400);
  }

  const invoice = generateInvoice(tenantId, year, month);

  if (!invoice) {
    return c.json({ error: "Billing não encontrado para o período" }, 404);
  }

  return c.json(invoice);
});

// ── GET /billing/tenants/:tenantId/export/:year/:month ───────────────────────

billingRoutes.get("/billing/tenants/:tenantId/export/:year/:month", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const tenantId = c.req.param("tenantId");
  const year = parseInt(c.req.param("year"), 10);
  const month = parseInt(c.req.param("month"), 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return c.json({ error: "year/month inválidos" }, 400);
  }

  const csv = exportTenantCsv(tenantId, year, month);

  if (csv === null) {
    return c.json({ error: "Billing não encontrado para o período" }, 404);
  }

  const filename = `billing-${tenantId}-${year}-${String(month).padStart(2, "0")}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});

// ── POST /billing/consolidate ────────────────────────────────────────────────

billingRoutes.post("/billing/consolidate", async (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "JSON inválido" }, 400);
  }

  const schema = z.object({
    year: z.number().int().min(2020).max(2100),
    month: z.number().int().min(1).max(12),
  });

  const result = schema.safeParse(body);
  if (!result.success) {
    return c.json({ error: "year/month inválidos", details: result.error.flatten() }, 400);
  }

  const { year, month } = result.data;
  const consolidation = consolidateMonth(year, month);

  return c.json({ ok: true, year, month, ...consolidation });
});

// ── GET /billing/tenants/:tenantId/markup ────────────────────────────────────

billingRoutes.get("/billing/tenants/:tenantId/markup", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const tenantId = c.req.param("tenantId");
  const markupPct = getMarkupOverride(tenantId);

  return c.json({ tenantId, markupPct });
});

// ── PUT /billing/tenants/:tenantId/markup ────────────────────────────────────

billingRoutes.put("/billing/tenants/:tenantId/markup", async (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const tenantId = c.req.param("tenantId");

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "JSON inválido" }, 400);
  }

  const schema = z.object({ markupPct: z.number().min(0) });
  const result = schema.safeParse(body);
  if (!result.success) {
    return c.json({ error: "markupPct inválido", details: result.error.flatten() }, 400);
  }

  setMarkupOverride(tenantId, result.data.markupPct);

  return c.json({ ok: true, tenantId, markupPct: result.data.markupPct });
});

// ── GET /billing/profitability (?months default 6) ───────────────────────────

billingRoutes.get("/billing/profitability", (c) => {
  const denied = requireSysuser(c);
  if (denied) return denied;

  const monthsStr = c.req.query("months");
  const months = monthsStr ? parseInt(monthsStr, 10) : 6;

  if (isNaN(months) || months < 1 || months > 120) {
    return c.json({ error: "months inválido (1–120)" }, 400);
  }

  const data = getProfitability(months);
  return c.json({ months, data });
});
