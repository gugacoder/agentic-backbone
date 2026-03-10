import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MemoryChunk, MemorySearchResult, MemoryStatus } from "./types";

export function memoryStatusQuery(agentId: string) {
  return queryOptions({
    queryKey: ["memory", agentId, "status"],
    queryFn: () => api.get<MemoryStatus>(`/agents/${agentId}/memory/status`),
    enabled: !!agentId,
  });
}

export function memoryChunksQuery(agentId: string, limit = 100, offset = 0) {
  return queryOptions({
    queryKey: ["memory", agentId, "chunks", limit, offset],
    queryFn: () => api.get<MemoryChunk[]>(`/agents/${agentId}/memory/chunks?limit=${limit}&offset=${offset}`),
    enabled: !!agentId,
  });
}

export function useSearchMemory() {
  return useMutation({
    mutationFn: ({ agentId, query, maxResults }: { agentId: string; query: string; maxResults?: number }) =>
      api.post<MemorySearchResult[]>(`/agents/${agentId}/memory/search`, { query, maxResults }),
  });
}

export function useSyncMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (agentId: string) => api.post(`/agents/${agentId}/memory/sync`),
    onSuccess: (_, agentId) => {
      qc.invalidateQueries({ queryKey: ["memory", agentId] });
    },
  });
}

export function useResetMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (agentId: string) => api.post(`/agents/${agentId}/memory/reset`),
    onSuccess: (_, agentId) => {
      qc.invalidateQueries({ queryKey: ["memory", agentId] });
    },
  });
}
