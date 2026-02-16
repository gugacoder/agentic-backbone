import { useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSSE } from "./use-sse";
import { toast } from "sonner";

/**
 * Subscribes to evolution module SSE events.
 * Invalidates relevant queries and shows toasts for critical events.
 * Returns alert state for instances (unstable / prolonged-offline).
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

export function useEvolutionSSE(): { alerts: InstanceAlerts } {
  const qc = useQueryClient();
  const alertsRef = useRef<InstanceAlerts>({
    unstable: new Set(),
    prolongedOffline: new Set(),
  });

  const getAlerts = useCallback(() => alertsRef.current, []);

  useSSE({
    url: "/system/events",
    additionalEventTypes: EVOLUTION_SSE_EVENTS,
    onEvent: (type, data) => {
      if (!type.startsWith("module:evolution:")) return;

      const subtype = type.replace("module:evolution:", "");
      const d = data as Record<string, unknown> | undefined;
      const instanceName = (d?.instanceName ?? d?.name ?? "") as string;

      // Track alert states
      if (subtype === "instance-unstable" && instanceName) {
        alertsRef.current.unstable.add(instanceName);
      }
      if (subtype === "instance-prolonged-offline" && instanceName) {
        alertsRef.current.prolongedOffline.add(instanceName);
      }
      // Clear alerts when instance reconnects
      if (subtype === "instance-connected" && instanceName) {
        alertsRef.current.unstable.delete(instanceName);
        alertsRef.current.prolongedOffline.delete(instanceName);
      }
      // Clear alerts when instance is removed
      if (subtype === "instance-removed" && instanceName) {
        alertsRef.current.unstable.delete(instanceName);
        alertsRef.current.prolongedOffline.delete(instanceName);
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

  return { alerts: getAlerts() };
}
