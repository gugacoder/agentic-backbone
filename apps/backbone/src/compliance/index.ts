import { getClassification, saveClassification } from "./classification.js";
import {
  generateChecklist,
  reconcileChecklist,
  getChecklist,
  getChecklistItem,
  updateChecklistItem,
} from "./checklist.js";
import type {
  Classification,
  ClassificationUpdate,
  ChecklistItem,
  ChecklistItemUpdate,
  RiskLevel,
} from "./schemas.js";
import { explainDecision } from "./decision-explainer.js";
import {
  generateReport,
  getReport,
  listReportsByAgent,
  listReportsByType,
  listAllReports,
} from "./reports.js";
import type {
  ReportType,
  ComplianceReport,
  GenerateReportOpts,
} from "./reports.js";
import type { DecisionExplanation } from "./decision-explainer.js";

export type {
  Classification,
  ClassificationUpdate,
  ChecklistItem,
  ChecklistItemUpdate,
  RiskLevel,
  ReportType,
  ComplianceReport,
  GenerateReportOpts,
  DecisionExplanation,
};

export { CHECKLIST_KEYS_BY_LEVEL, ALL_CHECKLIST_ITEMS } from "./schemas.js";

export const complianceReports = {
  generate: generateReport,
  get: getReport,
  listByAgent: listReportsByAgent,
  listByType: listReportsByType,
  listAll: listAllReports,
};

export const decisionExplainer = { explain: explainDecision };

export const complianceManager = {
  /**
   * Classify an agent (or reclassify).
   * On first classification: generates checklist for the given level.
   * On reclassification: reconciles checklist (adds/removes items).
   */
  classify(
    agentId: string,
    update: ClassificationUpdate,
    actor: string
  ): { classification: Classification; checklist: ChecklistItem[] } {
    const existing = getClassification(agentId);
    const classification = saveClassification(agentId, update, actor);

    let checklist: ChecklistItem[];
    if (!existing) {
      // First classification → generate fresh checklist
      checklist = generateChecklist(agentId, update.riskLevel);
    } else if (existing.riskLevel !== update.riskLevel) {
      // Reclassification → reconcile (add/remove items, preserve statuses)
      checklist = reconcileChecklist(agentId, update.riskLevel);
    } else {
      // Same level, just updated metadata
      checklist = getChecklist(agentId);
    }

    return { classification, checklist };
  },

  /** Get current classification for an agent (null if never classified). */
  getClassification(agentId: string): Classification | null {
    return getClassification(agentId);
  },

  /** Get all checklist items for an agent. */
  getChecklist(agentId: string): ChecklistItem[] {
    return getChecklist(agentId);
  },

  /** Get a single checklist item. */
  getChecklistItem(agentId: string, itemKey: string): ChecklistItem | null {
    return getChecklistItem(agentId, itemKey);
  },

  /** Update status and/or evidence for a checklist item. */
  updateChecklistItem(
    agentId: string,
    itemKey: string,
    update: ChecklistItemUpdate,
    actor: string
  ): ChecklistItem | null {
    return updateChecklistItem(agentId, itemKey, update, actor);
  },

  /**
   * Compliance summary for an agent: classification + checklist counts.
   */
  getSummary(agentId: string): {
    classification: Classification | null;
    totalItems: number;
    compliantItems: number;
    pendingItems: number;
    complianceRate: number;
    checklist: ChecklistItem[];
  } {
    const classification = getClassification(agentId);
    const checklist = getChecklist(agentId);
    const totalItems = checklist.length;
    const compliantItems = checklist.filter((i) => i.status === "compliant").length;
    const pendingItems = checklist.filter((i) => i.status === "pending").length;
    const complianceRate = totalItems > 0 ? compliantItems / totalItems : 0;

    return {
      classification,
      totalItems,
      compliantItems,
      pendingItems,
      complianceRate,
      checklist,
    };
  },
};
