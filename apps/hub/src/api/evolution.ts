import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ── Types ────────────────────────────────────────────────────

export interface EvolutionInstance {
  instanceName: string;
  instanceId: string;
  state: "open" | "connecting" | "close";
  since: number;
  previousState: string | null;
  owner: string | null;
  profileName: string | null;
  durationMs: number;
}

export interface EvolutionProbeResult {
  timestamp: number;
  status: "online" | "offline";
  responseTimeMs: number | null;
  error: string | null;
}

export interface EvolutionHealth {
  apiState: "online" | "offline" | "unknown";
  lastProbe: EvolutionProbeResult | null;
}

export interface EvolutionInstanceSettings {
  reject_call: boolean;
  msg_call: string;
  groups_ignore: boolean;
  always_online: boolean;
  read_messages: boolean;
  read_status: boolean;
}

export interface EvolutionQR {
  base64: string;
  code?: string;
}

// ── Queries ──────────────────────────────────────────────────

export const evolutionHealthQuery = queryOptions({
  queryKey: ["evolution", "health"],
  queryFn: () => api.get<EvolutionHealth>("/modules/evolution/health"),
  refetchInterval: 10_000,
});

export const evolutionInstancesQuery = queryOptions({
  queryKey: ["evolution", "instances"],
  queryFn: () => api.get<EvolutionInstance[]>("/modules/evolution/instances"),
  refetchInterval: 10_000,
});

export function evolutionInstanceQuery(name: string) {
  return queryOptions({
    queryKey: ["evolution", "instances", name],
    queryFn: () => api.get<EvolutionInstance>(`/modules/evolution/instances/${name}`),
    enabled: !!name,
    refetchInterval: 10_000,
  });
}

export function evolutionInstanceSettingsQuery(name: string) {
  return queryOptions({
    queryKey: ["evolution", "instances", name, "settings"],
    queryFn: () => api.get<EvolutionInstanceSettings>(`/modules/evolution/instances/${name}/settings`),
    enabled: !!name,
  });
}

export function evolutionInstanceQRQuery(name: string, enabled: boolean) {
  return queryOptions({
    queryKey: ["evolution", "instances", name, "qr"],
    queryFn: () => api.get<EvolutionQR>(`/modules/evolution/instances/${name}/qr`),
    enabled: !!name && enabled,
  });
}

// ── Mutations ────────────────────────────────────────────────

export function useCreateInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { instanceName: string }) =>
      api.post<EvolutionInstance>("/modules/evolution/instances", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["evolution", "instances"] });
    },
  });
}

export function useDeleteInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api.delete(`/modules/evolution/instances/${name}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["evolution", "instances"] });
    },
  });
}

export function useReconnectInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api.post(`/modules/evolution/instances/${name}/reconnect`),
    onSuccess: (_, name) => {
      qc.invalidateQueries({ queryKey: ["evolution", "instances", name] });
      qc.invalidateQueries({ queryKey: ["evolution", "instances"] });
    },
  });
}

export function useRestartInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api.post(`/modules/evolution/instances/${name}/restart`),
    onSuccess: (_, name) => {
      qc.invalidateQueries({ queryKey: ["evolution", "instances", name] });
      qc.invalidateQueries({ queryKey: ["evolution", "instances"] });
    },
  });
}

export function useUpdateInstanceSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, settings }: { name: string; settings: Partial<EvolutionInstanceSettings> }) =>
      api.patch(`/modules/evolution/instances/${name}/settings`, settings),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["evolution", "instances", vars.name, "settings"] });
    },
  });
}
