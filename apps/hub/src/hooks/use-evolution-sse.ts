import { useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { useSSE } from "./use-sse";
import { toast } from "sonner";

/**
 * Subscribes to evolution module SSE events.
 * Invalidates relevant queries and shows toasts for critical events.
 * Alert state (unstable / prolonged-offline) stored in Zustand for global access.
 *
 * MUST be called once at the layout level so toasts fire regardless of active page.
 */
export const EVOLUTION_SSE_EVENTS = [
  "module:evolution:api-online",
  "module:evolution:api-offline",
  "module:evolution:instance-discovered",
  "module:evolution:instance-removed",
  "module:evolution:instance-connected",
  "module:evolution:instance-disconnected",
  "module:evolution:instance-reconnecting",
  "module:evolution:instance-unstable",
  "module:evolution:instance-prolonged-offline",
  "module:evolution:action-success",
  "module:evolution:action-failed",
  "module:evolution:action-exhausted",
];

export interface InstanceAlerts {
  unstable: Set<string>;
  prolongedOffline: Set<string>;
}

interface EvolutionAlertsState {
  alerts: InstanceAlerts;
  addUnstable: (name: string) => void;
  addProlongedOffline: (name: string) => void;
  clearAlerts: (name: string) => void;
}

export const useEvolutionAlertsStore = create<EvolutionAlertsState>((set) => ({
  alerts: { unstable: new Set<string>(), prolongedOffline: new Set<string>() },
  addUnstable: (name) =>
    set((s) => {
      s.alerts.unstable.add(name);
      return { alerts: { unstable: new Set(s.alerts.unstable), prolongedOffline: s.alerts.prolongedOffline } };
    }),
  addProlongedOffline: (name) =>
    set((s) => {
      s.alerts.prolongedOffline.add(name);
      return { alerts: { unstable: s.alerts.unstable, prolongedOffline: new Set(s.alerts.prolongedOffline) } };
    }),
  clearAlerts: (name) =>
    set((s) => {
      s.alerts.unstable.delete(name);
      s.alerts.prolongedOffline.delete(name);
      return {
        alerts: {
          unstable: new Set(s.alerts.unstable),
          prolongedOffline: new Set(s.alerts.prolongedOffline),
        },
      };
    }),
}));

export function useEvolutionSSE(): void {
  const qc = useQueryClient();
  const { addUnstable, addProlongedOffline, clearAlerts } = useEvolutionAlertsStore();

  useSSE({
    url: "/system/events",
    additionalEventTypes: EVOLUTION_SSE_EVENTS,
    onEvent: (type, data) => {
      if (!type.startsWith("module:evolution:")) return;

      const subtype = type.replace("module:evolution:", "");
      const d = data as Record<string, unknown> | undefined;
      const instanceName = (d?.instanceName ?? d?.name ?? "") as string;

      // Track alert states in Zustand store
      if (subtype === "instance-unstable" && instanceName) {
        addUnstable(instanceName);
      }
      if (subtype === "instance-prolonged-offline" && instanceName) {
        addProlongedOffline(instanceName);
      }
      if (subtype === "instance-connected" && instanceName) {
        clearAlerts(instanceName);
      }
      if (subtype === "instance-removed" && instanceName) {
        clearAlerts(instanceName);
      }

      // Invalidate queries based on event type
      if (subtype === "api-online" || subtype === "api-offline") {
        qc.invalidateQueries({ queryKey: ["evolution", "health"] });
      }

      if (subtype.startsWith("instance-") || subtype.startsWith("action-")) {
        qc.invalidateQueries({ queryKey: ["evolution", "instances"] });
        if (instanceName) {
          qc.invalidateQueries({ queryKey: ["evolution", "instances", instanceName] });
        }
      }

      // Toasts for critical events
      switch (subtype) {
        case "instance-unstable":
          toast.warning(`Instancia ${instanceName} com conexao instavel`);
          break;
        case "instance-prolonged-offline":
          toast.error(`Instancia ${instanceName} offline ha mais de 5 minutos`);
          break;
        case "action-success":
          toast.success(`Acao executada com sucesso em ${instanceName}`);
          break;
        case "action-failed":
          toast.error(`Falha ao executar acao em ${instanceName}`);
          break;
        case "action-exhausted":
          toast.error(`Todas as tentativas esgotadas para ${instanceName}`);
          break;
      }
    },
  });
}
