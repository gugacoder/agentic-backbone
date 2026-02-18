import chokidar, { type FSWatcher } from "chokidar";
import { join } from "node:path";
import type { Database as DatabaseType } from "better-sqlite3";
import { initMemoryDb } from "./schema.js";
import { syncMemoryFiles } from "./indexer.js";
import { hybridSearch } from "./search.js";
import { resolveProvider } from "./embeddings.js";
import { agentDir } from "../context/paths.js";
import {
  type MemorySearchResult,
  type MemorySearchManager,
  type MemoryConfig,
  DEFAULT_MEMORY_CONFIG,
} from "./types.js";
import type { EmbeddingProvider } from "./types.js";

interface ManagerConfig {
  dbPath: string;
  contextDir: string;
  provider?: string;
  config?: Partial<MemoryConfig>;
}

class MemoryManager implements MemorySearchManager {
  private db: DatabaseType | null = null;
  private provider: EmbeddingProvider | null = null;
  private watcher: FSWatcher | null = null;
  private dirty = true;
  private syncing = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly dbPath: string;
  private readonly contextDir: string;
  private readonly providerName?: string;
  private readonly config: MemoryConfig;

  constructor(cfg: ManagerConfig) {
    this.dbPath = cfg.dbPath;
    this.contextDir = cfg.contextDir;
    this.providerName = cfg.provider;
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...cfg.config };
  }

  private init(): { db: DatabaseType; provider: EmbeddingProvider } {
    if (!this.db) {
      this.db = initMemoryDb(this.dbPath);
      this.startWatcher();
    }
    if (!this.provider) {
      this.provider = resolveProvider(this.providerName);
    }
    return { db: this.db, provider: this.provider };
  }

  private startWatcher(): void {
    try {
      this.watcher = chokidar.watch(this.contextDir, {
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
      });
      this.watcher.on("all", () => {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          this.dirty = true;
        }, 1000);
      });
    } catch {
      // watcher may fail on some platforms — that's OK
    }
  }

  async search(
    query: string,
    opts?: { maxResults?: number }
  ): Promise<MemorySearchResult[]> {
    const { db, provider } = this.init();

    if (this.dirty) {
      await this.sync();
    }

    const queryVec = await provider.embedQuery(query);
    return hybridSearch(
      db,
      query,
      queryVec,
      this.config,
      opts?.maxResults ?? this.config.maxResults,
      this.config.minScore
    );
  }

  markDirty(): void {
    this.dirty = true;
  }

  async sync(opts?: { force?: boolean }): Promise<void> {
    if (this.syncing && !opts?.force) return;
    this.syncing = true;
    try {
      const { db, provider } = this.init();
      await syncMemoryFiles(db, this.contextDir, provider, {
        tokens: this.config.tokens,
        overlap: this.config.overlap,
      });
      this.dirty = false;
    } finally {
      this.syncing = false;
    }
  }

  status(): { fileCount: number; chunkCount: number } {
    if (!this.db) return { fileCount: 0, chunkCount: 0 };

    const files = (
      this.db.prepare(`SELECT COUNT(*) as c FROM files`).get() as { c: number }
    ).c;
    const chunks = (
      this.db.prepare(`SELECT COUNT(*) as c FROM chunks`).get() as { c: number }
    ).c;
    return { fileCount: files, chunkCount: chunks };
  }

  listChunks(opts?: { limit?: number; offset?: number }): {
    id: number;
    fileId: number;
    path: string;
    startLine: number;
    endLine: number;
    text: string;
  }[] {
    if (!this.db) return [];
    const limit = opts?.limit ?? 100;
    const offset = opts?.offset ?? 0;
    return this.db
      .prepare(
        `SELECT c.rowid as id, c.file_id as fileId, f.path, c.start_line as startLine,
                c.end_line as endLine, c.text
         FROM chunks c JOIN files f ON c.file_id = f.rowid
         ORDER BY f.path, c.start_line
         LIMIT ? OFFSET ?`
      )
      .all(limit, offset) as {
        id: number;
        fileId: number;
        path: string;
        startLine: number;
        endLine: number;
        text: string;
      }[];
  }

  deleteChunks(ids: number[]): number {
    if (!this.db || ids.length === 0) return 0;
    const placeholders = ids.map(() => "?").join(", ");
    const result = this.db
      .prepare(`DELETE FROM chunks WHERE rowid IN (${placeholders})`)
      .run(...ids);
    return result.changes;
  }

  resetMemory(): void {
    if (!this.db) return;
    this.db.exec(`DELETE FROM chunks`);
    this.db.exec(`DELETE FROM files`);
    this.dirty = true;
  }

  close(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.provider = null;
  }
}

// --- Singleton registry ---

const managers = new Map<string, MemoryManager>();

export function getMemoryManager(config: ManagerConfig): MemoryManager {
  let mgr = managers.get(config.dbPath);
  if (!mgr) {
    mgr = new MemoryManager(config);
    managers.set(config.dbPath, mgr);
  }
  return mgr;
}

export function closeAllManagers(): void {
  for (const mgr of managers.values()) mgr.close();
  managers.clear();
}

export function getAgentMemoryManager(agentId: string): MemoryManager {
  const dir = agentDir(agentId);
  const dbPath = join(dir, ".memory.sqlite");
  return getMemoryManager({ dbPath, contextDir: dir });
}
