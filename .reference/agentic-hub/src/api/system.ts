import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { HealthStatus, SystemStats, SystemInfo, GlobalAgentStats } from "./types";

export const healthQuery = queryOptions({
  queryKey: ["health"],
  queryFn: () => api.get<HealthStatus>("/health"),
  refetchInterval: 10_000,
});

export const systemStatsQuery = queryOptions({
  queryKey: ["system", "stats"],
  queryFn: () => api.get<SystemStats>("/system/stats"),
  refetchInterval: 15_000,
});

export const systemInfoQuery = queryOptions({
  queryKey: ["system", "info"],
  queryFn: () => api.get<SystemInfo>("/system/info"),
});

export const systemEnvQuery = queryOptions({
  queryKey: ["system", "env"],
  queryFn: () => api.get<Record<string, unknown>>("/system/env"),
});

export const contextTreeQuery = queryOptions({
  queryKey: ["system", "context-tree"],
  queryFn: () => api.get<{ root: string; tree: unknown[] }>("/system/context-tree"),
});

export const globalHeartbeatStatsQuery = queryOptions({
  queryKey: ["system", "heartbeat", "stats"],
  queryFn: () => api.get<GlobalAgentStats[]>("/system/heartbeat/stats"),
  refetchInterval: 30_000,
});

export function useRefreshSystem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/system/refresh"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["channels"] });
      qc.invalidateQueries({ queryKey: ["health"] });
    },
  });
}
