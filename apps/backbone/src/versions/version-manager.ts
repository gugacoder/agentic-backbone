import { join } from "node:path";
import { mkdirSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { db } from "../db/index.js";
import { agentDir } from "../context/paths.js";
import { eventBus } from "../events/index.js";

const DEFAULT_KEEP = 50;

export interface CreateVersionOpts {
  changeNote?: string;
  evalRunId?: number;
  createdBy?: string;
}

/**
 * Returns the next sequential version number for (agentId, fileName).
 */
export function nextVersionNum(agentId: string, fileName: string): number {
  const row = db
    .prepare(
      `SELECT MAX(version_num) as max_v FROM config_versions WHERE agent_id = ? AND file_name = ?`
    )
    .get(agentId, fileName) as { max_v: number | null } | undefined;
  return (row?.max_v ?? 0) + 1;
}

/**
 * Saves currentContent as a new versioned snapshot before the file is overwritten.
 * Returns the new version number.
 */
export function createVersion(
  agentId: string,
  fileName: string,
  currentContent: string,
  opts?: CreateVersionOpts
): number {
  const versionNum = nextVersionNum(agentId, fileName);
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("Z", "Z");
  const paddedNum = String(versionNum).padStart(3, "0");
  const versionFileName = `v${paddedNum}_${timestamp}.md`;

  const versionsDir = join(agentDir(agentId), ".versions", fileName);
  mkdirSync(versionsDir, { recursive: true });

  const filePath = join(versionsDir, versionFileName);
  writeFileSync(filePath, currentContent, "utf-8");

  db.prepare(
    `INSERT INTO config_versions (agent_id, file_name, version_num, file_path, size_bytes, change_note, eval_run_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    agentId,
    fileName,
    versionNum,
    filePath,
    Buffer.byteLength(currentContent, "utf-8"),
    opts?.changeNote ?? null,
    opts?.evalRunId ?? null,
    opts?.createdBy ?? null
  );

  pruneVersions(agentId, fileName, DEFAULT_KEEP);

  eventBus.emit("config:version_changed", {
    agentId,
    file: fileName,
    versionFrom: versionNum > 1 ? String(versionNum - 1) : null,
    versionTo: String(versionNum),
  });

  return versionNum;
}

/**
 * Removes oldest versions beyond keepCount (default 50).
 */
export function pruneVersions(
  agentId: string,
  fileName: string,
  keepCount: number = DEFAULT_KEEP
): void {
  const rows = db
    .prepare(
      `SELECT id, file_path FROM config_versions
       WHERE agent_id = ? AND file_name = ?
       ORDER BY version_num DESC`
    )
    .all(agentId, fileName) as Array<{ id: number; file_path: string }>;

  if (rows.length <= keepCount) return;

  const toDelete = rows.slice(keepCount);
  const deleteStmt = db.prepare(`DELETE FROM config_versions WHERE id = ?`);

  for (const row of toDelete) {
    try {
      unlinkSync(row.file_path);
    } catch {
      // File may already be gone; continue
    }
    deleteStmt.run(row.id);
  }
}
