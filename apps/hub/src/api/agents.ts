import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Agent, HeartbeatLogEntry, HeartbeatStats } from "./types";

export const agentsQuery = queryOptions({
  queryKey: ["agents"],
  queryFn: () => api.get<Agent[]>("/agents"),
});

export function agentQuery(id: string) {
  return queryOptions({
    queryKey: ["agents", id],
    queryFn: () => api.get<Agent>(`/agents/${id}`),
    enabled: !!id,
  });
}

export function agentFilesQuery(id: string) {
  return queryOptions({
    queryKey: ["agents", id, "files"],
    queryFn: () => api.get<string[]>(`/agents/${id}/files`),
    enabled: !!id,
  });
}

export function agentFileQuery(id: string, filename: string) {
  return queryOptions({
    queryKey: ["agents", id, "files", filename],
    queryFn: () => api.get<{ filename: string; content: string }>(`/agents/${id}/files/${filename}`),
    enabled: !!id && !!filename,
  });
}

export function agentHeartbeatQuery(id: string) {
  return queryOptions({
    queryKey: ["agents", id, "heartbeat"],
    queryFn: () => api.get<Record<string, unknown>>(`/agents/${id}/heartbeat`),
    enabled: !!id,
    refetchInterval: 10_000,
  });
}

export function heartbeatHistoryQuery(id: string, limit = 50, offset = 0) {
  return queryOptions({
    queryKey: ["agents", id, "heartbeat", "history", limit, offset],
    queryFn: () =>
      api.get<{ rows: HeartbeatLogEntry[]; total: number }>(
        `/agents/${id}/heartbeat/history?limit=${limit}&offset=${offset}`
      ),
    enabled: !!id,
    refetchInterval: 30_000,
  });
}

export function heartbeatStatsQuery(id: string) {
  return queryOptions({
    queryKey: ["agents", id, "heartbeat", "stats"],
    queryFn: () => api.get<HeartbeatStats>(`/agents/${id}/heartbeat/stats`),
    enabled: !!id,
    refetchInterval: 30_000,
  });
}

export function agentMemoryStatusQuery(id: string) {
  return queryOptions({
    queryKey: ["agents", id, "memory", "status"],
    queryFn: () => api.get<{ fileCount: number; chunkCount: number }>(`/agents/${id}/memory/status`),
    enabled: !!id,
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Agent> & { owner: string; slug: string }) =>
      api.post<Agent>("/agents", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });
}

export function useUpdateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      api.patch<Agent>(`/agents/${id}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["agents", vars.id] });
    },
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/agents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });
}

export function useToggleAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.patch<Agent>(`/agents/${id}`, { enabled }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["agents", vars.id] });
    },
  });
}

export function useToggleHeartbeat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.post(`/agents/${id}/heartbeat/toggle`, { enabled }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["agents", vars.id, "heartbeat"] });
      qc.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}

export function useSaveAgentFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, filename, content }: { id: string; filename: string; content: string }) =>
      api.put(`/agents/${id}/files/${filename}`, { content }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["agents", vars.id, "files"] });
    },
  });
}
