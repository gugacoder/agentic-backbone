import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { randomUUID } from "node:crypto";
import type { Database as DatabaseType } from "better-sqlite3";
import type { EmbeddingProvider } from "./types.js";
import { chunkMarkdown, hashText } from "./chunker.js";

// --- Vector/Blob conversion ---

export function vectorToBlob(vec: number[]): Buffer {
  return Buffer.from(new Float32Array(vec).buffer);
}

export function blobToVector(blob: Buffer): number[] {
  return [...new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / 4)];
}

// --- Embedding cache ---

export function loadCachedEmbeddings(
  db: DatabaseType,
  provider: string,
  model: string,
  hashes: string[]
): Map<string, number[]> {
  const result = new Map<string, number[]>();
  const batchSize = 500;

  for (let i = 0; i < hashes.length; i += batchSize) {
    const batch = hashes.slice(i, i + batchSize);
    const placeholders = batch.map(() => "?").join(",");
    const rows = db
      .prepare(
        `SELECT hash, embedding FROM embedding_cache
         WHERE provider = ? AND model = ? AND hash IN (${placeholders})`
      )
      .all(provider, model, ...batch) as { hash: string; embedding: Buffer }[];

    for (const row of rows) {
      result.set(row.hash, blobToVector(row.embedding));
    }
  }

  return result;
}

export function storeCachedEmbeddings(
  db: DatabaseType,
  provider: string,
  model: string,
  entries: { hash: string; embedding: number[] }[]
): void {
  const insert = db.prepare(
    `INSERT OR REPLACE INTO embedding_cache (provider, model, hash, embedding)
     VALUES (?, ?, ?, ?)`
  );
  const tx = db.transaction(() => {
    for (const { hash, embedding } of entries) {
      insert.run(provider, model, hash, vectorToBlob(embedding));
    }
  });
  tx();
}

// --- File indexing ---

interface FileEntry {
  path: string;
  fullPath: string;
  hash: string;
  mtime: number;
  size: number;
  content: string;
}

export async function indexFile(
  db: DatabaseType,
  entry: FileEntry,
  provider: EmbeddingProvider,
  chunking: { tokens: number; overlap: number },
  cacheEnabled: boolean = true
): Promise<number> {
  const chunks = chunkMarkdown(entry.content, chunking);
  if (chunks.length === 0) return 0;

  // Check cache for existing embeddings
  const hashes = chunks.map((c) => c.hash);
  const cached = cacheEnabled
    ? loadCachedEmbeddings(db, provider.id, provider.model, hashes)
    : new Map<string, number[]>();

  // Find uncached chunks
  const uncachedIndices: number[] = [];
  for (let i = 0; i < chunks.length; i++) {
    if (!cached.has(chunks[i].hash)) uncachedIndices.push(i);
  }

  // Embed uncached chunks
  if (uncachedIndices.length > 0) {
    const texts = uncachedIndices.map((i) => chunks[i].text);
    const embeddings = await provider.embedBatch(texts);

    const toCache: { hash: string; embedding: number[] }[] = [];
    for (let j = 0; j < uncachedIndices.length; j++) {
      const idx = uncachedIndices[j];
      cached.set(chunks[idx].hash, embeddings[j]);
      toCache.push({ hash: chunks[idx].hash, embedding: embeddings[j] });
    }

    if (cacheEnabled && toCache.length > 0) {
      storeCachedEmbeddings(db, provider.id, provider.model, toCache);
    }
  }

  // Upsert chunks + vectors in transaction
  const deleteChunks = db.prepare(`DELETE FROM chunks WHERE path = ?`);
  const deleteVecs = db.prepare(
    `DELETE FROM chunks_vec WHERE chunk_id IN (SELECT id FROM chunks WHERE path = ?)`
  );
  const insertChunk = db.prepare(
    `INSERT INTO chunks (id, path, source, start_line, end_line, hash, model, text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertVec = db.prepare(
    `INSERT INTO chunks_vec (chunk_id, embedding) VALUES (?, ?)`
  );
  const upsertFile = db.prepare(
    `INSERT OR REPLACE INTO files (path, hash, mtime, size) VALUES (?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    deleteVecs.run(entry.path);
    deleteChunks.run(entry.path);

    // Upsert file BEFORE chunks — chunks.path has FK to files(path)
    upsertFile.run(entry.path, entry.hash, entry.mtime, entry.size);

    for (const chunk of chunks) {
      const chunkId = randomUUID();
      insertChunk.run(
        chunkId,
        entry.path,
        "memory",
        chunk.startLine,
        chunk.endLine,
        chunk.hash,
        provider.model,
        chunk.text
      );

      const vec = cached.get(chunk.hash);
      if (vec) {
        insertVec.run(chunkId, vectorToBlob(vec));
      }
    }
  });
  tx();

  return chunks.length;
}

// --- Sync pipeline ---

function listMarkdownFiles(dir: string): FileEntry[] {
  if (!existsSync(dir)) return [];
  const entries: FileEntry[] = [];

  function walk(current: string): void {
    for (const name of readdirSync(current)) {
      const full = join(current, name);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (name.endsWith(".md")) {
        const content = readFileSync(full, "utf-8");
        entries.push({
          path: relative(dir, full).replace(/\\/g, "/"),
          fullPath: full,
          hash: hashText(content),
          mtime: stat.mtimeMs,
          size: stat.size,
          content,
        });
      }
    }
  }

  walk(dir);
  return entries;
}

export async function syncMemoryFiles(
  db: DatabaseType,
  contextDir: string,
  provider: EmbeddingProvider,
  options?: { tokens?: number; overlap?: number }
): Promise<{ indexed: number; removed: number; chunks: number }> {
  const files = listMarkdownFiles(contextDir);
  const chunking = {
    tokens: options?.tokens ?? 400,
    overlap: options?.overlap ?? 80,
  };

  // Get existing file hashes from DB
  const existing = new Map<string, string>();
  const rows = db.prepare(`SELECT path, hash FROM files`).all() as {
    path: string;
    hash: string;
  }[];
  for (const row of rows) existing.set(row.path, row.hash);

  let indexed = 0;
  let totalChunks = 0;

  // Index changed files
  for (const file of files) {
    const prevHash = existing.get(file.path);
    if (prevHash === file.hash) {
      existing.delete(file.path);
      continue;
    }

    const chunks = await indexFile(db, file, provider, chunking);
    totalChunks += chunks;
    indexed++;
    existing.delete(file.path);
  }

  // Remove stale entries
  const removeFile = db.prepare(`DELETE FROM files WHERE path = ?`);
  const removeChunkVecs = db.prepare(
    `DELETE FROM chunks_vec WHERE chunk_id IN (SELECT id FROM chunks WHERE path = ?)`
  );
  const removeChunks = db.prepare(`DELETE FROM chunks WHERE path = ?`);

  let removed = 0;
  for (const stalePath of existing.keys()) {
    const tx = db.transaction(() => {
      removeChunkVecs.run(stalePath);
      removeChunks.run(stalePath);
      removeFile.run(stalePath);
    });
    tx();
    removed++;
  }

  return { indexed, removed, chunks: totalChunks };
}
