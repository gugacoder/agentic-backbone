import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { getClassification } from "./classification.js";
import { getChecklist } from "./checklist.js";
import { explainDecision } from "./decision-explainer.js";
import { getAgent } from "../agents/registry.js";
import type { TraceType } from "../traces/index.js";

// ---------- Types ------------------------------------------------------------

export type ReportType = "audit" | "dpia" | "human_oversight" | "decision_explanation";

export interface ComplianceReport {
  id: string;
  agentId: string | null;
  reportType: ReportType;
  title: string;
  content: unknown; // JSON-structured content
  generatedBy: string;
  generatedAt: string;
  periodFrom: string | null;
  periodTo: string | null;
}

export interface GenerateReportOpts {
  agentId?: string;
  reportType: ReportType;
  generatedBy: string;
  periodFrom?: string;
  periodTo?: string;
  /** For decision_explanation reports: provide trace info */
  traceType?: TraceType;
  traceId?: string;
}

// ---------- DB helpers -------------------------------------------------------

interface DbRow {
  id: string;
  agent_id: string | null;
  report_type: string;
  title: string;
  content: string;
  generated_by: string;
  generated_at: string;
  period_from: string | null;
  period_to: string | null;
}

function rowToReport(row: DbRow): ComplianceReport {
  return {
    id: row.id,
    agentId: row.agent_id,
    reportType: row.report_type as ReportType,
    title: row.title,
    content: JSON.parse(row.content) as unknown,
    generatedBy: row.generated_by,
    generatedAt: row.generated_at,
    periodFrom: row.period_from,
    periodTo: row.period_to,
  };
}

const insertReport = db.prepare(`
  INSERT INTO compliance_reports (id, agent_id, report_type, title, content, generated_by, generated_at, period_from, period_to)
  VALUES (:id, :agent_id, :report_type, :title, :content, :generated_by, datetime('now'), :period_from, :period_to)
`);

const selectReportById = db.prepare<{ id: string }, DbRow>(
  `SELECT * FROM compliance_reports WHERE id = :id`
);

const selectReportsByAgent = db.prepare<{ agent_id: string }, DbRow>(
  `SELECT * FROM compliance_reports WHERE agent_id = :agent_id ORDER BY generated_at DESC`
);

const selectReportsByType = db.prepare<{ report_type: string }, DbRow>(
  `SELECT * FROM compliance_reports WHERE report_type = :report_type ORDER BY generated_at DESC`
);

const selectAllReports = db.prepare<[], DbRow>(
  `SELECT * FROM compliance_reports ORDER BY generated_at DESC`
);

// ---------- Report builders --------------------------------------------------

interface ApprovalRow {
  id: number;
  agent_id: string;
  session_id: string | null;
  tool_name: string;
  action_label: string;
  status: string;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
}

interface VersionRow {
  id: number;
  agent_id: string;
  file_name: string;
  version_num: number;
  change_note: string | null;
  created_at: string;
  created_by: string | null;
}

interface HeartbeatRow {
  id: number;
  agent_id: string;
  ts: string;
  status: string | null;
  preview: string | null;
  duration_ms: number | null;
  cost_usd: number;
}

function buildAuditReport(
  agentId: string,
  periodFrom: string | null,
  periodTo: string | null
): { title: string; content: unknown } {
  const classification = getClassification(agentId);
  const checklist = getChecklist(agentId);

  // Recent decisions (heartbeat + cron logs as decision proxy)
  let heartbeatSql = `SELECT * FROM heartbeat_log WHERE agent_id = ? ORDER BY ts DESC LIMIT 50`;
  const heartbeatParams: unknown[] = [agentId];
  if (periodFrom) {
    heartbeatSql = `SELECT * FROM heartbeat_log WHERE agent_id = ? AND ts >= ? ORDER BY ts DESC LIMIT 50`;
    heartbeatParams.push(periodFrom);
  }
  const decisions = db.prepare(heartbeatSql).all(...heartbeatParams) as HeartbeatRow[];

  // HITL logs
  let approvalSql = `SELECT * FROM approval_requests WHERE agent_id = ? ORDER BY created_at DESC LIMIT 50`;
  const approvalParams: unknown[] = [agentId];
  if (periodFrom) {
    approvalSql = `SELECT * FROM approval_requests WHERE agent_id = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 50`;
    approvalParams.push(periodFrom);
  }
  const hitlLogs = db.prepare(approvalSql).all(...approvalParams) as ApprovalRow[];

  // Instruction versions
  const versions = db
    .prepare(`SELECT * FROM config_versions WHERE agent_id = ? ORDER BY version_num DESC LIMIT 20`)
    .all(agentId) as VersionRow[];

  return {
    title: `Relatório de Auditoria — ${agentId}`,
    content: {
      reportType: "audit",
      agentId,
      generatedAt: new Date().toISOString(),
      period: { from: periodFrom, to: periodTo },
      classification: classification
        ? {
            riskLevel: classification.riskLevel,
            riskJustification: classification.riskJustification,
            classifiedBy: classification.classifiedBy,
            classifiedAt: classification.classifiedAt,
            reviewDueAt: classification.reviewDueAt,
          }
        : null,
      checklistSummary: {
        total: checklist.length,
        compliant: checklist.filter((i) => i.status === "compliant").length,
        nonCompliant: checklist.filter((i) => i.status === "non_compliant").length,
        pending: checklist.filter((i) => i.status === "pending").length,
        items: checklist.map((i) => ({
          key: i.itemKey,
          label: i.itemLabel,
          category: i.category,
          status: i.status,
          evidence: i.evidence,
          updatedAt: i.updatedAt,
        })),
      },
      decisions: decisions.map((d) => ({
        id: d.id,
        timestamp: d.ts,
        status: d.status,
        preview: d.preview,
        durationMs: d.duration_ms,
        costUsd: d.cost_usd,
      })),
      hitlLogs: hitlLogs.map((a) => ({
        id: a.id,
        toolName: a.tool_name,
        actionLabel: a.action_label,
        status: a.status,
        decidedBy: a.decided_by,
        decidedAt: a.decided_at,
        createdAt: a.created_at,
        sessionId: a.session_id,
      })),
      instructionVersions: versions.map((v) => ({
        versionNum: v.version_num,
        fileName: v.file_name,
        changeNote: v.change_note,
        createdAt: v.created_at,
        createdBy: v.created_by,
      })),
    },
  };
}

function buildDpiaReport(
  agentId: string
): { title: string; content: unknown } {
  const agent = getAgent(agentId);
  const classification = getClassification(agentId);
  const checklist = getChecklist(agentId);

  // Gather tool names from recent heartbeat steps (proxy for data processing activities)
  const recentHeartbeats = db
    .prepare(`SELECT preview FROM heartbeat_log WHERE agent_id = ? ORDER BY ts DESC LIMIT 10`)
    .all(agentId) as Array<{ preview: string | null }>;

  const approvalCount = db
    .prepare(`SELECT COUNT(*) as cnt FROM approval_requests WHERE agent_id = ?`)
    .get(agentId) as { cnt: number } | undefined;

  const hasHumanOversight =
    checklist.find((i) => i.itemKey === "human_oversight")?.status === "compliant";

  return {
    title: `DPIA — Avaliação de Impacto na Proteção de Dados — ${agentId}`,
    content: {
      reportType: "dpia",
      agentId,
      generatedAt: new Date().toISOString(),
      template: "EU AI Act / GDPR Article 35",
      sections: {
        "1_agent_identification": {
          label: "1. Identificação do Sistema de IA",
          agentId,
          agentDescription: agent?.description ?? "(descrição não disponível)",
          agentRole: agent?.role ?? "(função não definida)",
          riskLevel: classification?.riskLevel ?? "não classificado",
          riskJustification: classification?.riskJustification ?? null,
          classifiedAt: classification?.classifiedAt ?? null,
        },
        "2_processing_description": {
          label: "2. Descrição do Tratamento de Dados",
          dataCategories: [
            "Mensagens de texto do utilizador",
            "Histórico de conversas",
            "Dados de sessão",
            "Logs de execução",
          ],
          purposes: [
            "Automação de tarefas",
            "Atendimento a utilizadores",
            "Processamento de informações",
          ],
          legalBasis: "Legítimo interesse / contrato (Art. 6(1)(b) GDPR)",
          retentionPeriod: "Definido pela política de retenção da organização",
          recentActivitySamples: recentHeartbeats
            .filter((h) => h.preview)
            .slice(0, 3)
            .map((h) => h.preview),
        },
        "3_necessity_proportionality": {
          label: "3. Necessidade e Proporcionalidade",
          automatedDecisionMaking: classification?.riskLevel === "high" || classification?.riskLevel === "limited",
          humanOversightEnabled: hasHumanOversight,
          humanApprovalRequestsTotal: approvalCount?.cnt ?? 0,
          safeguardsMeasures: checklist
            .filter((i) => i.status === "compliant")
            .map((i) => i.itemLabel),
        },
        "4_risk_assessment": {
          label: "4. Avaliação de Riscos",
          identifiedRisks: [
            {
              risk: "Decisões automatizadas com impacto significativo no utilizador",
              likelihood: classification?.riskLevel === "high" ? "alta" : "média",
              severity: "alta",
              mitigations: ["Supervisão humana ativa (HITL)", "Kill-switch configurado", "Trilha de auditoria"],
            },
            {
              risk: "Exposição de dados pessoais em logs",
              likelihood: "média",
              severity: "média",
              mitigations: ["Truncamento de conteúdo nos traces", "Controlo de acesso por JWT"],
            },
            {
              risk: "Viés algorítmico nas respostas",
              likelihood: "média",
              severity: "média",
              mitigations: ["Versionamento de instruções", "Avaliação periódica de outputs"],
            },
          ],
        },
        "5_dpo_consultation": {
          label: "5. Consulta ao DPO",
          required: classification?.riskLevel === "high",
          completed: checklist.find((i) => i.itemKey === "dpia_completed")?.status === "compliant",
          evidence: checklist.find((i) => i.itemKey === "dpia_completed")?.evidence ?? null,
        },
        "6_checklist_status": {
          label: "6. Status do Checklist de Conformidade",
          items: checklist.map((i) => ({
            key: i.itemKey,
            label: i.itemLabel,
            status: i.status,
            evidence: i.evidence,
          })),
        },
      },
      nextReviewDue: classification?.reviewDueAt ?? null,
    },
  };
}

function buildHumanOversightReport(
  agentId: string,
  periodFrom: string | null,
  periodTo: string | null
): { title: string; content: unknown } {
  let sql = `SELECT * FROM approval_requests WHERE agent_id = ? ORDER BY created_at DESC`;
  const params: unknown[] = [agentId];

  if (periodFrom) {
    sql = `SELECT * FROM approval_requests WHERE agent_id = ? AND created_at >= ? ORDER BY created_at DESC`;
    params.push(periodFrom);
  }

  const approvals = db.prepare(sql).all(...params) as ApprovalRow[];

  const total = approvals.length;
  const approved = approvals.filter((a) => a.status === "approved").length;
  const rejected = approvals.filter((a) => a.status === "rejected").length;
  const pending = approvals.filter((a) => a.status === "pending").length;

  return {
    title: `Relatório de Supervisão Humana (HITL) — ${agentId}`,
    content: {
      reportType: "human_oversight",
      agentId,
      generatedAt: new Date().toISOString(),
      period: { from: periodFrom, to: periodTo },
      summary: {
        total,
        approved,
        rejected,
        pending,
        approvalRate: total > 0 ? approved / total : null,
      },
      logs: approvals.map((a) => ({
        id: a.id,
        toolName: a.tool_name,
        actionLabel: a.action_label,
        status: a.status,
        decidedBy: a.decided_by,
        decidedAt: a.decided_at,
        createdAt: a.created_at,
        sessionId: a.session_id,
      })),
    },
  };
}

function buildDecisionExplanationReport(
  agentId: string,
  traceType: TraceType,
  traceId: string
): { title: string; content: unknown } {
  const explanation = explainDecision(traceType, traceId);

  if (!explanation) {
    return {
      title: `Explicação de Decisão — trace ${traceId} não encontrado`,
      content: {
        reportType: "decision_explanation",
        agentId,
        traceId,
        error: "Trace não encontrado ou indisponível.",
        generatedAt: new Date().toISOString(),
      },
    };
  }

  return {
    title: `Explicação de Decisão — ${agentId} (${traceType}:${traceId})`,
    content: {
      reportType: "decision_explanation",
      agentId: explanation.agentId,
      traceId: explanation.traceId,
      traceType,
      generatedAt: new Date().toISOString(),
      timestamp: explanation.timestamp,
      input: explanation.input,
      decision: explanation.decision,
      reasoning: explanation.reasoning,
      toolsUsed: explanation.toolsUsed,
      instructionVersion: explanation.instructionVersion,
      memoryContext: explanation.memoryContext,
      humanApproval: explanation.humanApproval ?? null,
    },
  };
}

// ---------- Persist & retrieve -----------------------------------------------

function persistReport(
  agentId: string | null,
  reportType: ReportType,
  title: string,
  content: unknown,
  generatedBy: string,
  periodFrom: string | null,
  periodTo: string | null
): ComplianceReport {
  const id = randomUUID();
  insertReport.run({
    id,
    agent_id: agentId,
    report_type: reportType,
    title,
    content: JSON.stringify(content),
    generated_by: generatedBy,
    period_from: periodFrom ?? null,
    period_to: periodTo ?? null,
  });

  const row = selectReportById.get({ id });
  if (!row) throw new Error(`Failed to persist compliance report ${id}`);
  return rowToReport(row);
}

// ---------- Public API -------------------------------------------------------

export function generateReport(opts: GenerateReportOpts): ComplianceReport {
  const {
    agentId = null,
    reportType,
    generatedBy,
    periodFrom = null,
    periodTo = null,
    traceType,
    traceId,
  } = opts;

  let title: string;
  let content: unknown;

  switch (reportType) {
    case "audit": {
      if (!agentId) throw new Error("agentId is required for audit reports");
      const result = buildAuditReport(agentId, periodFrom, periodTo);
      title = result.title;
      content = result.content;
      break;
    }
    case "dpia": {
      if (!agentId) throw new Error("agentId is required for dpia reports");
      const result = buildDpiaReport(agentId);
      title = result.title;
      content = result.content;
      break;
    }
    case "human_oversight": {
      if (!agentId) throw new Error("agentId is required for human_oversight reports");
      const result = buildHumanOversightReport(agentId, periodFrom, periodTo);
      title = result.title;
      content = result.content;
      break;
    }
    case "decision_explanation": {
      if (!agentId) throw new Error("agentId is required for decision_explanation reports");
      if (!traceType || !traceId) {
        throw new Error("traceType and traceId are required for decision_explanation reports");
      }
      const result = buildDecisionExplanationReport(agentId, traceType, traceId);
      title = result.title;
      content = result.content;
      break;
    }
    default:
      throw new Error(`Unknown report type: ${reportType as string}`);
  }

  return persistReport(agentId, reportType, title, content, generatedBy, periodFrom, periodTo);
}

export function getReport(reportId: string): ComplianceReport | null {
  const row = selectReportById.get({ id: reportId });
  return row ? rowToReport(row) : null;
}

export function listReportsByAgent(agentId: string): ComplianceReport[] {
  return selectReportsByAgent.all({ agent_id: agentId }).map(rowToReport);
}

export function listReportsByType(reportType: ReportType): ComplianceReport[] {
  return selectReportsByType.all({ report_type: reportType }).map(rowToReport);
}

export function listAllReports(): ComplianceReport[] {
  return selectAllReports.all().map(rowToReport);
}
