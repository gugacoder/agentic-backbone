import { Hono } from "hono";
import {
  complianceManager,
  complianceReports,
  decisionExplainer,
} from "../compliance/index.js";
import {
  ClassificationUpdateSchema,
  ChecklistItemUpdateSchema,
} from "../compliance/schemas.js";
import { getAgent, listAgents } from "../agents/registry.js";
import { getAuthUser, assertOwnership } from "./auth-helpers.js";
import { formatError } from "../utils/errors.js";
import type { TraceType } from "../traces/index.js";
import { z } from "zod";

export const complianceRoutes = new Hono();

// ---------- Helpers ----------------------------------------------------------

function assertAgentOwnership(
  c: Parameters<typeof getAuthUser>[0],
  agentId: string
): Response | null {
  const agent = getAgent(agentId);
  if (!agent) return c.json({ error: "not found" }, 404);
  return assertOwnership(c, agent.owner);
}

// ---------- GET /agents/:id/compliance — full compliance view ----------------

complianceRoutes.get("/agents/:id/compliance", (c) => {
  const agentId = c.req.param("id");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;

  const summary = complianceManager.getSummary(agentId);
  const reports = complianceReports.listByAgent(agentId);

  return c.json({
    ...summary,
    reportsCount: reports.length,
    latestReport: reports[0] ?? null,
  });
});

// ---------- GET /agents/:id/compliance/classification -----------------------

complianceRoutes.get("/agents/:id/compliance/classification", (c) => {
  const agentId = c.req.param("id");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;

  const classification = complianceManager.getClassification(agentId);
  if (!classification) return c.json({ classification: null });
  return c.json({ classification });
});

// ---------- PUT /agents/:id/compliance/classification -----------------------

complianceRoutes.put("/agents/:id/compliance/classification", async (c) => {
  const agentId = c.req.param("id");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }

  const parsed = ClassificationUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation error", issues: parsed.error.issues }, 422);
  }

  try {
    const auth = getAuthUser(c);
    const result = complianceManager.classify(agentId, parsed.data, auth.user);
    return c.json(result);
  } catch (err) {
    return c.json({ error: formatError(err) }, 500);
  }
});

// ---------- GET /agents/:id/compliance/checklist ----------------------------

complianceRoutes.get("/agents/:id/compliance/checklist", (c) => {
  const agentId = c.req.param("id");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;

  const checklist = complianceManager.getChecklist(agentId);
  return c.json({ checklist });
});

// ---------- PUT /agents/:id/compliance/checklist/:itemKey ------------------

complianceRoutes.put("/agents/:id/compliance/checklist/:itemKey", async (c) => {
  const agentId = c.req.param("id");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;

  const itemKey = c.req.param("itemKey");

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }

  const parsed = ChecklistItemUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation error", issues: parsed.error.issues }, 422);
  }

  try {
    const auth = getAuthUser(c);
    const item = complianceManager.updateChecklistItem(agentId, itemKey, parsed.data, auth.user);
    if (!item) return c.json({ error: "checklist item not found" }, 404);
    return c.json({ item });
  } catch (err) {
    return c.json({ error: formatError(err) }, 500);
  }
});

// ---------- POST /agents/:id/compliance/reports — generate report -----------

const GenerateReportBodySchema = z.object({
  reportType: z.enum(["audit", "dpia", "human_oversight", "decision_explanation"]),
  periodFrom: z.string().optional(),
  periodTo: z.string().optional(),
  traceType: z.enum(["heartbeat", "conversation", "cron"]).optional(),
  traceId: z.string().optional(),
});

complianceRoutes.post("/agents/:id/compliance/reports", async (c) => {
  const agentId = c.req.param("id");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }

  const parsed = GenerateReportBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation error", issues: parsed.error.issues }, 422);
  }

  try {
    const auth = getAuthUser(c);
    const report = complianceReports.generate({
      agentId,
      reportType: parsed.data.reportType,
      generatedBy: auth.user,
      periodFrom: parsed.data.periodFrom,
      periodTo: parsed.data.periodTo,
      traceType: parsed.data.traceType as TraceType | undefined,
      traceId: parsed.data.traceId,
    });
    return c.json({ report }, 201);
  } catch (err) {
    return c.json({ error: formatError(err) }, 500);
  }
});

// ---------- GET /agents/:id/compliance/reports — list reports ---------------

complianceRoutes.get("/agents/:id/compliance/reports", (c) => {
  const agentId = c.req.param("id");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;

  const reports = complianceReports.listByAgent(agentId);
  return c.json({ reports });
});

// ---------- GET /agents/:id/compliance/reports/:reportId — report details ---

complianceRoutes.get("/agents/:id/compliance/reports/:reportId", (c) => {
  const agentId = c.req.param("id");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;

  const reportId = c.req.param("reportId");
  const report = complianceReports.get(reportId);

  if (!report) return c.json({ error: "not found" }, 404);
  // Ensure the report belongs to the requested agent
  if (report.agentId !== agentId) return c.json({ error: "not found" }, 404);

  return c.json({ report });
});

// ---------- POST /agents/:id/compliance/explain — explain decision ----------

const ExplainBodySchema = z.object({
  traceType: z.enum(["heartbeat", "conversation", "cron"]),
  traceId: z.string(),
});

complianceRoutes.post("/agents/:id/compliance/explain", async (c) => {
  const agentId = c.req.param("id");
  const denied = assertAgentOwnership(c, agentId);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }

  const parsed = ExplainBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation error", issues: parsed.error.issues }, 422);
  }

  try {
    const explanation = decisionExplainer.explain(
      parsed.data.traceType as TraceType,
      parsed.data.traceId
    );

    if (!explanation) {
      return c.json({ error: "trace not found" }, 404);
    }

    // Ensure trace belongs to the requested agent
    if (explanation.agentId !== agentId) {
      return c.json({ error: "trace does not belong to this agent" }, 403);
    }

    return c.json({ explanation });
  } catch (err) {
    return c.json({ error: formatError(err) }, 500);
  }
});

// ---------- GET /compliance/overview — all agents overview ------------------

complianceRoutes.get("/compliance/overview", (c) => {
  const auth = getAuthUser(c);

  let agents = listAgents();

  // Non-sysuser: filter to own agents only
  if (auth.role !== "sysuser") {
    agents = agents.filter((a) => a.owner === auth.user);
  }

  const totalAgents = agents.length;
  const byRiskLevel: Record<string, number> = { high: 0, limited: 0, minimal: 0 };
  const nonCompliantItems: Array<{ agentId: string; itemKey: string; category: string }> = [];
  const pendingReviews: Array<{ agentId: string; reviewDueAt: string }> = [];
  const overviewAgents: Array<{
    agentId: string;
    riskLevel: "high" | "limited" | "minimal" | null;
    complianceRate: number;
    checklistTotal: number;
    checklistCompliant: number;
    reviewDueAt: string | null;
    hasOverdueReview: boolean;
  }> = [];

  let totalCompliant = 0;
  let totalItems = 0;

  for (const agent of agents) {
    const classification = complianceManager.getClassification(agent.id);
    const riskLevel = classification?.riskLevel ?? null;
    if (riskLevel) {
      byRiskLevel[riskLevel] = (byRiskLevel[riskLevel] ?? 0) + 1;
    }

    // Pending reviews
    if (classification?.reviewDueAt) {
      pendingReviews.push({
        agentId: agent.id,
        reviewDueAt: classification.reviewDueAt,
      });
    }

    // Checklist compliance
    const checklist = complianceManager.getChecklist(agent.id);
    const checklistNonApplicable = checklist.filter((i) => i.status === "not_applicable").length;
    const checklistTotal = checklist.length - checklistNonApplicable;
    let checklistCompliant = 0;

    totalItems += checklist.length;
    for (const item of checklist) {
      if (item.status === "compliant") {
        totalCompliant++;
        checklistCompliant++;
      } else if (item.status === "non_compliant") {
        nonCompliantItems.push({
          agentId: agent.id,
          itemKey: item.itemKey,
          category: item.category,
        });
      }
    }

    const agentComplianceRate = checklistTotal > 0 ? checklistCompliant / checklistTotal : 0;
    const hasOverdueReview = classification?.reviewDueAt
      ? new Date(classification.reviewDueAt) < new Date()
      : false;

    overviewAgents.push({
      agentId: agent.id,
      riskLevel: riskLevel as "high" | "limited" | "minimal" | null,
      complianceRate: agentComplianceRate,
      checklistTotal: checklistTotal,
      checklistCompliant: checklistCompliant,
      reviewDueAt: classification?.reviewDueAt ?? null,
      hasOverdueReview,
    });
  }

  const complianceRate = totalItems > 0 ? totalCompliant / totalItems : 0;

  return c.json({
    totalAgents,
    byRiskLevel,
    complianceRate,
    nonCompliantItems,
    pendingReviews,
    agents: overviewAgents,
  });
});

// ---------- GET /compliance/dpia-template — DPIA template -------------------

complianceRoutes.get("/compliance/dpia-template", (c) => {
  const agentIdParam = c.req.query("agentId");

  if (agentIdParam) {
    // If agentId provided, generate pre-filled DPIA from agent data
    const denied = assertAgentOwnership(c, agentIdParam);
    if (denied) return denied;

    try {
      const report = complianceReports.generate({
        agentId: agentIdParam,
        reportType: "dpia",
        generatedBy: "system",
      });
      return c.json({ template: report.content, reportId: report.id });
    } catch (err) {
      return c.json({ error: formatError(err) }, 500);
    }
  }

  // Return blank DPIA template structure
  return c.json({
    template: {
      reportType: "dpia",
      template: "EU AI Act / GDPR Article 35",
      sections: {
        "1_agent_identification": {
          label: "1. Identificação do Sistema de IA",
          agentId: "",
          agentDescription: "",
          agentRole: "",
          riskLevel: "",
          riskJustification: "",
          classifiedAt: null,
        },
        "2_processing_description": {
          label: "2. Descrição do Tratamento de Dados",
          dataCategories: [],
          purposes: [],
          legalBasis: "",
          retentionPeriod: "",
        },
        "3_necessity_proportionality": {
          label: "3. Necessidade e Proporcionalidade",
          automatedDecisionMaking: false,
          humanOversightEnabled: false,
          safeguardsMeasures: [],
        },
        "4_risk_assessment": {
          label: "4. Avaliação de Riscos",
          identifiedRisks: [],
        },
        "5_dpo_consultation": {
          label: "5. Consulta ao DPO",
          required: false,
          completed: false,
          evidence: null,
        },
        "6_checklist_status": {
          label: "6. Status do Checklist de Conformidade",
          items: [],
        },
      },
      nextReviewDue: null,
    },
  });
});
