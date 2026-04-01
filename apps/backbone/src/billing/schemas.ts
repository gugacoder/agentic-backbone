import { z } from "zod";

export const BillingConfigSchema = z.object({
  id: z.string().default("default"),
  currency: z.string().default("BRL"),
  defaultMarkupPct: z.number().min(0).default(0),
  agencyName: z.string().nullable().optional(),
  agencyDocument: z.string().nullable().optional(),
  agencyAddress: z.string().nullable().optional(),
  agencyBankInfo: z.string().nullable().optional(),
  agencyLogoUrl: z.string().nullable().optional(),
  invoiceFooter: z.string().nullable().optional(),
  updatedAt: z.string().optional(),
});

export const BillingConfigUpdateSchema = BillingConfigSchema.omit({
  id: true,
  updatedAt: true,
}).partial();

export const TenantBillingSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  periodYear: z.number().int(),
  periodMonth: z.number().int().min(1).max(12),
  tokensInput: z.number().int().default(0),
  tokensOutput: z.number().int().default(0),
  tokensTotal: z.number().int().default(0),
  costBase: z.number().default(0),
  markupPct: z.number().default(0),
  costWithMarkup: z.number().default(0),
  status: z.enum(["draft", "finalized", "exported"]).default("draft"),
  finalizedAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});

export const TenantBillingDetailSchema = z.object({
  id: z.string(),
  billingId: z.string(),
  agentId: z.string(),
  agentLabel: z.string(),
  model: z.string(),
  operationType: z.string(),
  tokensInput: z.number().int().default(0),
  tokensOutput: z.number().int().default(0),
  tokensTotal: z.number().int().default(0),
  costBase: z.number().default(0),
  invocations: z.number().int().default(0),
});

export const TenantMarkupOverrideSchema = z.object({
  tenantId: z.string(),
  markupPct: z.number().min(0),
  updatedAt: z.string().optional(),
});

export const ConsolidateParamsSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
});

export const InvoiceItemSchema = z.object({
  agentLabel: z.string(),
  model: z.string(),
  operationType: z.string(),
  tokensTotal: z.number().int(),
  costBase: z.number(),
  costWithMarkup: z.number(),
  invocations: z.number().int(),
});

export const InvoiceSchema = z.object({
  invoiceNumber: z.string(),
  period: z.object({ year: z.number(), month: z.number() }),
  agency: z.object({
    name: z.string().nullable(),
    document: z.string().nullable(),
    address: z.string().nullable(),
    bankInfo: z.string().nullable(),
    logoUrl: z.string().nullable(),
  }),
  tenant: z.object({ id: z.string(), name: z.string() }),
  items: z.array(InvoiceItemSchema),
  totals: z.object({
    tokensTotal: z.number().int(),
    costBase: z.number(),
    markupPct: z.number(),
    costWithMarkup: z.number(),
  }),
  footer: z.string().nullable(),
  generatedAt: z.string(),
});

export type BillingConfig = z.infer<typeof BillingConfigSchema>;
export type BillingConfigUpdate = z.infer<typeof BillingConfigUpdateSchema>;
export type TenantBilling = z.infer<typeof TenantBillingSchema>;
export type TenantBillingDetail = z.infer<typeof TenantBillingDetailSchema>;
export type TenantMarkupOverride = z.infer<typeof TenantMarkupOverrideSchema>;
export type ConsolidateParams = z.infer<typeof ConsolidateParamsSchema>;
export type Invoice = z.infer<typeof InvoiceSchema>;
export type InvoiceItem = z.infer<typeof InvoiceItemSchema>;
