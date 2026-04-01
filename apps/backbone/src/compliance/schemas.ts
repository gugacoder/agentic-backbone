import { z } from "zod";

// ---------- Risk level ---------------------------------------------------

export const RiskLevelSchema = z.enum(["high", "limited", "minimal"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

// ---------- Checklist item -----------------------------------------------

export const ChecklistCategorySchema = z.enum([
  "transparency",
  "oversight",
  "documentation",
  "data_governance",
  "risk_management",
]);
export type ChecklistCategory = z.infer<typeof ChecklistCategorySchema>;

export const ChecklistStatusSchema = z.enum([
  "pending",
  "compliant",
  "non_compliant",
  "not_applicable",
]);
export type ChecklistStatus = z.infer<typeof ChecklistStatusSchema>;

export interface ChecklistItemDef {
  key: string;
  label: string;
  category: ChecklistCategory;
}

/** All possible checklist items ordered by priority */
export const ALL_CHECKLIST_ITEMS: ChecklistItemDef[] = [
  { key: "transparency_notice",    label: "Aviso de transparência ao usuário",                   category: "transparency" },
  { key: "decision_transparency",  label: "Transparência nas decisões automatizadas",             category: "transparency" },
  { key: "human_oversight",        label: "Supervisão humana ativa (HITL)",                       category: "oversight" },
  { key: "human_oversight_logs",   label: "Logs de supervisão humana mantidos",                   category: "oversight" },
  { key: "kill_switch",            label: "Kill-switch configurado e testado",                    category: "oversight" },
  { key: "instruction_versioning", label: "Versionamento de instruções do agente",               category: "documentation" },
  { key: "audit_trail",            label: "Trilha de auditoria de decisões",                     category: "documentation" },
  { key: "dpia_completed",         label: "DPIA (Avaliação de Impacto) concluída",               category: "documentation" },
  { key: "data_documentation",     label: "Documentação de dados pessoais processados",          category: "data_governance" },
  { key: "risk_assessment",        label: "Avaliação de risco documentada",                      category: "risk_management" },
  { key: "incident_response",      label: "Plano de resposta a incidentes definido",             category: "risk_management" },
];

/** Keys required per risk level */
export const CHECKLIST_KEYS_BY_LEVEL: Record<RiskLevel, string[]> = {
  high: [
    "human_oversight",
    "human_oversight_logs",
    "decision_transparency",
    "instruction_versioning",
    "data_documentation",
    "risk_assessment",
    "dpia_completed",
    "kill_switch",
    "audit_trail",
    "incident_response",
  ],
  limited: [
    "transparency_notice",
    "decision_transparency",
    "instruction_versioning",
    "data_documentation",
  ],
  minimal: ["transparency_notice"],
};

// ---------- Classification -----------------------------------------------

export const ClassificationSchema = z.object({
  agentId: z.string(),
  riskLevel: RiskLevelSchema,
  riskJustification: z.string().nullable(),
  classifiedBy: z.string(),
  classifiedAt: z.string(),
  reviewedAt: z.string().nullable(),
  reviewDueAt: z.string().nullable(),
});
export type Classification = z.infer<typeof ClassificationSchema>;

export const ClassificationUpdateSchema = z.object({
  riskLevel: RiskLevelSchema,
  riskJustification: z.string().optional(),
  reviewDueAt: z.string().optional(),
});
export type ClassificationUpdate = z.infer<typeof ClassificationUpdateSchema>;

// ---------- Checklist item (persisted) -----------------------------------

export const ChecklistItemSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  itemKey: z.string(),
  itemLabel: z.string(),
  category: ChecklistCategorySchema,
  status: ChecklistStatusSchema,
  evidence: z.string().nullable(),
  updatedBy: z.string().nullable(),
  updatedAt: z.string(),
});
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

export const ChecklistItemUpdateSchema = z.object({
  status: ChecklistStatusSchema,
  evidence: z.string().optional(),
});
export type ChecklistItemUpdate = z.infer<typeof ChecklistItemUpdateSchema>;
