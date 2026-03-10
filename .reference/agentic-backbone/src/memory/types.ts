export interface MemoryChunk {
  startLine: number;
  endLine: number;
  text: string;
  hash: string;
}

export interface EmbeddingProvider {
  id: string;
  model: string;
  dimensions: number;
  embedQuery(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

export interface MemorySearchResult {
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  snippet: string;
  source: string;
  citation: string;
}

export interface MemorySearchManager {
  search(query: string, opts?: { maxResults?: number }): Promise<MemorySearchResult[]>;
  sync(opts?: { force?: boolean }): Promise<void>;
  status(): { fileCount: number; chunkCount: number };
  close(): void;
}

export interface MemoryConfig {
  tokens: number;
  overlap: number;
  vectorWeight: number;
  textWeight: number;
  maxResults: number;
  minScore: number;
}

export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  tokens: 400,
  overlap: 80,
  vectorWeight: 0.7,
  textWeight: 0.3,
  maxResults: 6,
  minScore: 0.35,
};
