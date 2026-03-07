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
  totalRuns: number;
  byStatus: { ok: number; skipped: number; error: number };
  totalCostUsd: number;
  avgDurationMs: number;
  lastTimestamp?: string;
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
    queryFn: () => request<AgentStats>(`/agents/${id}/heartbeat/stats`),
  });
}

export interface HeartbeatLogEntry {
  id: string;
  status: "ok" | "skipped" | "error";
  durationMs: number;
  preview?: string;
  createdAt: string;
}

export function agentHeartbeatHistoryQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["agents", id, "heartbeat-history"],
    queryFn: () => request<HeartbeatLogEntry[]>(`/agents/${id}/heartbeat/history`),
  });
}

export async function toggleAgentEnabled(id: string): Promise<void> {
  await request(`/agents/${id}/heartbeat/toggle`, { method: "POST" });
}

export async function triggerHeartbeat(id: string): Promise<void> {
  await request(`/agents/${id}/heartbeat/trigger`, { method: "POST" });
}

export interface CreateAgentPayload {
  slug: string;
  owner: string;
  description?: string;
  enabled?: boolean;
}

export async function createAgent(payload: CreateAgentPayload): Promise<Agent> {
  return request<Agent>("/agents", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
