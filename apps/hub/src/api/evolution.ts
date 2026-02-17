import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ── Envelope ─────────────────────────────────────────────────

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  details?: unknown;
  retryAfterMs?: number;
  attempts?: number;
  maxRetries?: number;
}

const ERROR_MESSAGES: Record<string, string> = {
  api_offline: "Evolution API esta indisponivel",
  instance_not_found: "Instancia nao encontrada",
  create_failed: "Falha ao criar instancia",
  delete_failed: "Falha ao excluir instancia",
  qr_unavailable: "QR code indisponivel",
  cooldown_active: "Aguarde antes de tentar novamente",
  retries_exhausted: "Tentativas esgotadas",
  settings_fetch_failed: "Falha ao carregar configuracoes",
  settings_update_failed: "Falha ao salvar configuracoes",
  network_error: "Erro de conexao com o servidor",
};

export function friendlyMessage(errorCode: string): string {
  return ERROR_MESSAGES[errorCode] ?? "Ocorreu um erro inesperado";
}

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
});

export const evolutionInstancesQuery = queryOptions({
  queryKey: ["evolution", "instances"],
  queryFn: async () => {
    const result = await api.get<ApiResult<EvolutionInstance[]>>("/modules/evolution/instances");
    if (!result.ok) return [];
    return result.data!;
  },
});

export function evolutionInstanceQuery(name: string) {
  return queryOptions({
    queryKey: ["evolution", "instances", name],
    queryFn: async () => {
      const result = await api.get<ApiResult<EvolutionInstance>>(`/modules/evolution/instances/${name}`);
      if (!result.ok) return null;
      return result.data!;
    },
    enabled: !!name,
  });
}

export function evolutionInstanceSettingsQuery(name: string) {
  return queryOptions({
    queryKey: ["evolution", "instances", name, "settings"],
    queryFn: async () => {
      const result = await api.get<ApiResult<EvolutionInstanceSettings>>(`/modules/evolution/instances/${name}/settings`);
      if (!result.ok) return null;
      return result.data!;
    },
    enabled: !!name,
  });
}

export function evolutionInstanceQRQuery(name: string, enabled: boolean) {
  return queryOptions({
    queryKey: ["evolution", "instances", name, "qr"],
    queryFn: async () => {
      const result = await api.get<ApiResult<EvolutionQR>>(`/modules/evolution/instances/${name}/qr`);
      if (!result.ok) return null;
      return result.data!;
    },
    enabled: !!name && enabled,
  });
}

// ── Mutations ────────────────────────────────────────────────

export function useCreateInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { instanceName: string }) =>
      api.post<ApiResult<EvolutionInstance>>("/modules/evolution/instances", data),
    onSuccess: (result) => {
      if (result.ok) {
        qc.invalidateQueries({ queryKey: ["evolution", "instances"] });
      }
    },
  });
}

export function useDeleteInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api.delete<ApiResult<unknown>>(`/modules/evolution/instances/${name}`),
    onSuccess: (result) => {
      if (result.ok) {
        qc.invalidateQueries({ queryKey: ["evolution", "instances"] });
      }
    },
  });
}

export function useReconnectInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api.post<ApiResult<unknown>>(`/modules/evolution/instances/${name}/reconnect`),
    onSuccess: (result, name) => {
      if (result.ok) {
        qc.invalidateQueries({ queryKey: ["evolution", "instances", name] });
        qc.invalidateQueries({ queryKey: ["evolution", "instances"] });
      }
    },
  });
}

export function useRestartInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api.post<ApiResult<unknown>>(`/modules/evolution/instances/${name}/restart`),
    onSuccess: (result, name) => {
      if (result.ok) {
        qc.invalidateQueries({ queryKey: ["evolution", "instances", name] });
        qc.invalidateQueries({ queryKey: ["evolution", "instances"] });
      }
    },
  });
}

export function useUpdateInstanceSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, settings }: { name: string; settings: Partial<EvolutionInstanceSettings> }) =>
      api.patch<ApiResult<unknown>>(`/modules/evolution/instances/${name}/settings`, settings),
    onSuccess: (result, vars) => {
      if (result.ok) {
        qc.invalidateQueries({ queryKey: ["evolution", "instances", vars.name, "settings"] });
      }
    },
  });
}
