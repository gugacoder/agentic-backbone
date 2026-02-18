import type { Database as DatabaseType } from "better-sqlite3";
import type { MemoryConfig, MemorySearchResult } from "./types.js";
import { vectorToBlob } from "./indexer.js";

// --- Vector search ---

interface VecRow {
  chunk_id: string;
  distance: number;
  path: string;
  start_line: number;
  end_line: number;
  text: string;
}

export function searchVector(
  db: DatabaseType,
  queryVec: number[],
  limit: number
): { id: string; score: number; path: string; startLine: number; endLine: number; snippet: string }[] {
  const rows = db
    .prepare(
      `SELECT v.chunk_id, v.distance, c.path, c.start_line, c.end_line, c.text
       FROM chunks_vec v
       JOIN chunks c ON c.id = v.chunk_id
       WHERE v.embedding MATCH ?
       AND k = ?
       ORDER BY v.distance`
    )
    .all(vectorToBlob(queryVec), limit) as VecRow[];

  return rows.map((r) => ({
    id: r.chunk_id,
    score: 1 - r.distance,
    path: r.path,
    startLine: r.start_line,
    endLine: r.end_line,
    snippet: r.text,
  }));
}

// --- FTS5 keyword search ---

export function sanitizeFts5Query(raw: string): string {
  const words = raw.match(/\w+/g);
  if (!words || words.length === 0) return '""';
  const individual = words.map((w) => `"${w}"`).join(" ");
  // Also match underscore-joined identifiers (e.g. "capability test token" → "capability_test_token")
  if (words.length > 1) {
    const joined = `"${words.join("_")}"`;
    return `${individual} OR ${joined}`;
  }
  return individual;
}

interface FtsRow {
  rowid: number;
  rank: number;
  id: string;
  path: string;
  start_line: number;
  end_line: number;
  text: string;
}

export function searchKeyword(
  db: DatabaseType,
  query: string,
  limit: number
): { id: string; score: number; path: string; startLine: number; endLine: number; snippet: string }[] {
  const sanitized = sanitizeFts5Query(query);

  const rows = db
    .prepare(
      `SELECT c.rowid, chunks_fts.rank, c.id, c.path, c.start_line, c.end_line, c.text
       FROM chunks_fts
       JOIN chunks c ON c.rowid = chunks_fts.rowid
       WHERE chunks_fts MATCH ?
       ORDER BY chunks_fts.rank
       LIMIT ?`
    )
    .all(sanitized, limit) as FtsRow[];

  return rows.map((r) => ({
    id: r.id,
    score: -r.rank, // FTS5 rank is negative BM25
    path: r.path,
    startLine: r.start_line,
    endLine: r.end_line,
    snippet: r.text,
  }));
}

// --- Hybrid merge ---

interface SearchHit {
  id: string;
  score: number;
  path: string;
  startLine: number;
  endLine: number;
  snippet: string;
}

export function mergeHybridResults(
  vectorHits: SearchHit[],
  keywordHits: SearchHit[],
  config: MemoryConfig
): SearchHit[] {
  const merged = new Map<string, SearchHit & { vecScore: number; textScore: number }>();

  // Normalize keyword scores to [0,1] range
  const maxKeyword = keywordHits.length > 0
    ? Math.max(...keywordHits.map((h) => h.score))
    : 1;

  for (const hit of vectorHits) {
    merged.set(hit.id, { ...hit, vecScore: hit.score, textScore: 0 });
  }

  for (const hit of keywordHits) {
    const normalized = maxKeyword > 0 ? hit.score / maxKeyword : 0;
    const existing = merged.get(hit.id);
    if (existing) {
      existing.textScore = normalized;
    } else {
      merged.set(hit.id, { ...hit, vecScore: 0, textScore: normalized });
    }
  }

  return [...merged.values()]
    .map((h) => ({
      ...h,
      score: config.vectorWeight * h.vecScore + config.textWeight * h.textScore,
    }))
    .sort((a, b) => b.score - a.score);
}

// --- Public hybrid search ---

export function hybridSearch(
  db: DatabaseType,
  query: string,
  queryVec: number[],
  config: MemoryConfig,
  maxResults?: number,
  minScore?: number
): MemorySearchResult[] {
  const limit = (maxResults ?? config.maxResults) * 4; // candidate multiplier
  const vecHits = searchVector(db, queryVec, limit);
  const kwHits = searchKeyword(db, query, limit);
  const merged = mergeHybridResults(vecHits, kwHits, config);

  const threshold = minScore ?? config.minScore;
  const max = maxResults ?? config.maxResults;

  return merged
    .filter((h) => h.score >= threshold)
    .slice(0, max)
    .map((h) => ({
      path: h.path,
      startLine: h.startLine,
      endLine: h.endLine,
      score: h.score,
      snippet: h.snippet,
      source: "memory",
      citation: `${h.path}:${h.startLine}-${h.endLine}`,
    }));
}
