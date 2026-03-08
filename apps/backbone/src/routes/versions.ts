import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../db/index.js";
import { createVersion } from "../versions/version-manager.js";
import { getAgent } from "../agents/registry.js";
import { writeAgentFile } from "../agents/manager.js";
import { agentDir } from "../context/paths.js";
import { assertOwnership, getAuthUser } from "./auth-helpers.js";

export const versionRoutes = new Hono();

interface VersionRow {
  id: number;
  agent_id: string;
  file_name: string;
  version_num: number;
  file_path: string;
  size_bytes: number | null;
  change_note: string | null;
  eval_run_id: number | null;
  created_at: string;
  created_by: string | null;
}

function assertAgent(c: Parameters<typeof getAuthUser>[0], agentId: string) {
  const agent = getAgent(agentId);
  if (!agent) return c.json({ error: "not found" }, 404);
  return assertOwnership(c, agent.owner);
}

// GET /agents/:agentId/versions — list all versioned files for agent
versionRoutes.get("/agents/:agentId/versions", (c) => {
  const { agentId } = c.req.param();
  const denied = assertAgent(c, agentId);
  if (denied) return denied;

  const rows = db
    .prepare(
      `SELECT file_name, COUNT(*) as total_versions, MAX(version_num) as latest_version, MAX(created_at) as last_modified
       FROM config_versions WHERE agent_id = ?
       GROUP BY file_name ORDER BY file_name`
    )
    .all(agentId) as Array<{
    file_name: string;
    total_versions: number;
    latest_version: number;
    last_modified: string;
  }>;

  return c.json(rows);
});

// GET /agents/:agentId/versions/:filename — list versions in descending order
versionRoutes.get("/agents/:agentId/versions/:filename", (c) => {
  const { agentId, filename } = c.req.param();
  const denied = assertAgent(c, agentId);
  if (denied) return denied;

  const rows = db
    .prepare(
      `SELECT id, version_num, size_bytes, change_note, eval_run_id, created_at, created_by
       FROM config_versions WHERE agent_id = ? AND file_name = ?
       ORDER BY version_num DESC`
    )
    .all(agentId, filename) as Array<Omit<VersionRow, "agent_id" | "file_name" | "file_path">>;

  return c.json(rows);
});

// GET /agents/:agentId/versions/:filename/:versionNum — get version content
versionRoutes.get("/agents/:agentId/versions/:filename/:versionNum", (c) => {
  const { agentId, filename, versionNum } = c.req.param();
  const denied = assertAgent(c, agentId);
  if (denied) return denied;

  const row = db
    .prepare(
      `SELECT * FROM config_versions WHERE agent_id = ? AND file_name = ? AND version_num = ?`
    )
    .get(agentId, filename, Number(versionNum)) as VersionRow | undefined;

  if (!row) return c.json({ error: "version not found" }, 404);

  let content: string;
  try {
    content = readFileSync(row.file_path, "utf-8");
  } catch {
    return c.json({ error: "version file missing on disk" }, 500);
  }

  return c.json({
    agentId: row.agent_id,
    fileName: row.file_name,
    versionNum: row.version_num,
    sizeBytes: row.size_bytes,
    changeNote: row.change_note,
    createdAt: row.created_at,
    createdBy: row.created_by,
    content,
  });
});

// GET /agents/:agentId/versions/:filename/:versionNum/diff — diff vs previous version
versionRoutes.get("/agents/:agentId/versions/:filename/:versionNum/diff", (c) => {
  const { agentId, filename, versionNum } = c.req.param();
  const denied = assertAgent(c, agentId);
  if (denied) return denied;

  const num = Number(versionNum);

  const current = db
    .prepare(
      `SELECT * FROM config_versions WHERE agent_id = ? AND file_name = ? AND version_num = ?`
    )
    .get(agentId, filename, num) as VersionRow | undefined;

  if (!current) return c.json({ error: "version not found" }, 404);

  const previous = db
    .prepare(
      `SELECT * FROM config_versions WHERE agent_id = ? AND file_name = ? AND version_num < ?
       ORDER BY version_num DESC LIMIT 1`
    )
    .get(agentId, filename, num) as VersionRow | undefined;

  let currentContent: string;
  try {
    currentContent = readFileSync(current.file_path, "utf-8");
  } catch {
    return c.json({ error: "current version file missing on disk" }, 500);
  }

  let previousContent = "";
  if (previous) {
    try {
      previousContent = readFileSync(previous.file_path, "utf-8");
    } catch {
      previousContent = "";
    }
  }

  const diff = computeDiff(previousContent, currentContent);

  return c.json({
    agentId,
    fileName: filename,
    versionNum: num,
    previousVersionNum: previous?.version_num ?? null,
    diff,
  });
});

// POST /agents/:agentId/versions/:filename/:versionNum/rollback — rollback to version
versionRoutes.post("/agents/:agentId/versions/:filename/:versionNum/rollback", (c) => {
  const { agentId, filename, versionNum } = c.req.param();
  const denied = assertAgent(c, agentId);
  if (denied) return denied;

  const target = db
    .prepare(
      `SELECT * FROM config_versions WHERE agent_id = ? AND file_name = ? AND version_num = ?`
    )
    .get(agentId, filename, Number(versionNum)) as VersionRow | undefined;

  if (!target) return c.json({ error: "version not found" }, 404);

  let targetContent: string;
  try {
    targetContent = readFileSync(target.file_path, "utf-8");
  } catch {
    return c.json({ error: "target version file missing on disk" }, 500);
  }

  // Read current file to create safety snapshot before overwriting
  let currentContent: string;
  try {
    const liveFilePath = join(agentDir(agentId), filename);
    currentContent = readFileSync(liveFilePath, "utf-8");
  } catch {
    currentContent = "";
  }

  // Save safety snapshot of current state
  const safetyVersionNum = createVersion(agentId, filename, currentContent, {
    changeNote: `safety snapshot before rollback to v${versionNum}`,
    createdBy: "rollback",
  });

  // Write rolled-back content — triggers chokidar watcher for hot reload
  writeAgentFile(agentId, filename, targetContent);

  return c.json({
    ok: true,
    rolledBackTo: Number(versionNum),
    safetyVersionNum,
  });
});

// --- LCS diff implementation (no external lib) ---

type DiffLine = { type: "unchanged" | "added" | "removed"; line: number; content: string };

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText === "" ? [] : oldText.split("\n");
  const newLines = newText === "" ? [] : newText.split("\n");

  // Build LCS table
  const m = oldLines.length;
  const n = newLines.length;
  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        lcs[i]![j] = lcs[i - 1]![j - 1]! + 1;
      } else {
        lcs[i]![j] = Math.max(lcs[i - 1]![j]!, lcs[i]![j - 1]!);
      }
    }
  }

  // Backtrack to produce diff
  const result: DiffLine[] = [];
  let i = m;
  let j = n;
  const ops: Array<{ type: "unchanged" | "added" | "removed"; content: string }> = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.push({ type: "unchanged", content: oldLines[i - 1]! });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || lcs[i]![j - 1]! >= lcs[i - 1]![j]!)) {
      ops.push({ type: "added", content: newLines[j - 1]! });
      j--;
    } else {
      ops.push({ type: "removed", content: oldLines[i - 1]! });
      i--;
    }
  }

  ops.reverse();

  let lineNum = 1;
  for (const op of ops) {
    result.push({ type: op.type, line: lineNum, content: op.content });
    if (op.type !== "removed") lineNum++;
  }

  return result;
}
