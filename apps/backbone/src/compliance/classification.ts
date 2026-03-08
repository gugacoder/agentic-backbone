import { db } from "../db/index.js";
import type { Classification, ClassificationUpdate } from "./schemas.js";

interface DbRow {
  agent_id: string;
  risk_level: string;
  risk_justification: string | null;
  classified_by: string;
  classified_at: string;
  reviewed_at: string | null;
  review_due_at: string | null;
}

function rowToClassification(row: DbRow): Classification {
  return {
    agentId: row.agent_id,
    riskLevel: row.risk_level as Classification["riskLevel"],
    riskJustification: row.risk_justification,
    classifiedBy: row.classified_by,
    classifiedAt: row.classified_at,
    reviewedAt: row.reviewed_at,
    reviewDueAt: row.review_due_at,
  };
}

const selectClassification = db.prepare<{ agent_id: string }, DbRow>(
  `SELECT * FROM compliance_classification WHERE agent_id = :agent_id`
);

const upsertClassification = db.prepare(`
  INSERT INTO compliance_classification (
    agent_id, risk_level, risk_justification, classified_by, classified_at, review_due_at
  ) VALUES (
    :agent_id, :risk_level, :risk_justification, :classified_by, datetime('now'), :review_due_at
  )
  ON CONFLICT(agent_id) DO UPDATE SET
    risk_level         = excluded.risk_level,
    risk_justification = excluded.risk_justification,
    classified_by      = excluded.classified_by,
    classified_at      = datetime('now'),
    review_due_at      = excluded.review_due_at
`);

export function getClassification(agentId: string): Classification | null {
  const row = selectClassification.get({ agent_id: agentId });
  if (!row) return null;
  return rowToClassification(row);
}

export function saveClassification(
  agentId: string,
  update: ClassificationUpdate,
  actor: string
): Classification {
  upsertClassification.run({
    agent_id: agentId,
    risk_level: update.riskLevel,
    risk_justification: update.riskJustification ?? null,
    classified_by: actor,
    review_due_at: update.reviewDueAt ?? null,
  });

  const row = selectClassification.get({ agent_id: agentId });
  if (!row) throw new Error(`Failed to load classification for agent ${agentId}`);
  return rowToClassification(row);
}
