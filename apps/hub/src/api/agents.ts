import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface Agent {
  id: string;
  slug: string;
  owner: string;
  enabled: boolean;
  description?: string;
  heartbeatEnabled?: boolean;
}

export interface AgentStats {
  totalExecutions: number;
  statusCounts: { ok: number; skipped: number; error: number };
  totalCostUsd: number;
  avgDurationMs: number;
}

export function agentsQueryOptions() {
  return queryOptions({
    queryKey: ["agents"],
    queryFn: () => request<Agent[]>("/agents"),
  });
}

export function agentQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["agents", id],
    queryFn: () => request<Agent>(`/agents/${id}`),
  });
}

export function agentStatsQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["agents", id, "stats"],
    queryFn: () => request<AgentStats>(`/agents/${id}/stats`),
  });
}
