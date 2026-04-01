import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import {
  ALL_CHECKLIST_ITEMS,
  CHECKLIST_KEYS_BY_LEVEL,
  type RiskLevel,
  type ChecklistItem,
  type ChecklistItemUpdate,
} from "./schemas.js";

interface DbRow {
  id: string;
  agent_id: string;
  item_key: string;
  item_label: string;
  category: string;
  status: string;
  evidence: string | null;
  updated_by: string | null;
  updated_at: string;
}

function rowToItem(row: DbRow): ChecklistItem {
  return {
    id: row.id,
    agentId: row.agent_id,
    itemKey: row.item_key,
    itemLabel: row.item_label,
    category: row.category as ChecklistItem["category"],
    status: row.status as ChecklistItem["status"],
    evidence: row.evidence,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

const selectItems = db.prepare<{ agent_id: string }, DbRow>(
  `SELECT * FROM compliance_checklist WHERE agent_id = :agent_id ORDER BY category, item_key`
);

const selectItem = db.prepare<{ agent_id: string; item_key: string }, DbRow>(
  `SELECT * FROM compliance_checklist WHERE agent_id = :agent_id AND item_key = :item_key`
);

const insertItem = db.prepare(`
  INSERT INTO compliance_checklist (id, agent_id, item_key, item_label, category, status, evidence, updated_by, updated_at)
  VALUES (:id, :agent_id, :item_key, :item_label, :category, 'pending', NULL, NULL, datetime('now'))
  ON CONFLICT(agent_id, item_key) DO NOTHING
`);

const deleteItem = db.prepare(
  `DELETE FROM compliance_checklist WHERE agent_id = :agent_id AND item_key = :item_key`
);

const updateItem = db.prepare(`
  UPDATE compliance_checklist
  SET status = :status, evidence = :evidence, updated_by = :updated_by, updated_at = datetime('now')
  WHERE agent_id = :agent_id AND item_key = :item_key
`);

// ---------- public API -------------------------------------------------------

export function getChecklist(agentId: string): ChecklistItem[] {
  const rows = selectItems.all({ agent_id: agentId });
  return rows.map(rowToItem);
}

export function getChecklistItem(agentId: string, itemKey: string): ChecklistItem | null {
  const row = selectItem.get({ agent_id: agentId, item_key: itemKey });
  return row ? rowToItem(row) : null;
}

/**
 * Generate checklist items for the given risk level.
 * Adds missing items; does NOT touch existing ones (preserves status/evidence).
 */
export function generateChecklist(agentId: string, riskLevel: RiskLevel): ChecklistItem[] {
  const keys = CHECKLIST_KEYS_BY_LEVEL[riskLevel];
  const defsByKey = Object.fromEntries(ALL_CHECKLIST_ITEMS.map((d) => [d.key, d]));

  for (const key of keys) {
    const def = defsByKey[key];
    if (!def) continue;
    insertItem.run({
      id: randomUUID(),
      agent_id: agentId,
      item_key: def.key,
      item_label: def.label,
      category: def.category,
    });
  }

  return getChecklist(agentId);
}

/**
 * Reconcile checklist after a reclassification.
 * - Adds items required by the new level that are missing.
 * - Removes items NOT required by the new level.
 * Existing items that remain keep their status/evidence.
 */
export function reconcileChecklist(agentId: string, newLevel: RiskLevel): ChecklistItem[] {
  const requiredKeys = new Set(CHECKLIST_KEYS_BY_LEVEL[newLevel]);
  const defsByKey = Object.fromEntries(ALL_CHECKLIST_ITEMS.map((d) => [d.key, d]));

  // Add missing items
  for (const key of requiredKeys) {
    const def = defsByKey[key];
    if (!def) continue;
    insertItem.run({
      id: randomUUID(),
      agent_id: agentId,
      item_key: def.key,
      item_label: def.label,
      category: def.category,
    });
  }

  // Remove items not in the new level
  const existing = getChecklist(agentId);
  for (const item of existing) {
    if (!requiredKeys.has(item.itemKey)) {
      deleteItem.run({ agent_id: agentId, item_key: item.itemKey });
    }
  }

  return getChecklist(agentId);
}

export function updateChecklistItem(
  agentId: string,
  itemKey: string,
  update: ChecklistItemUpdate,
  actor: string
): ChecklistItem | null {
  updateItem.run({
    agent_id: agentId,
    item_key: itemKey,
    status: update.status,
    evidence: update.evidence ?? null,
    updated_by: actor,
  });

  return getChecklistItem(agentId, itemKey);
}
