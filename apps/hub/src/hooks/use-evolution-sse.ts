import { useQueryClient } from "@tanstack/react-query";
import { useSSE } from "./use-sse";
import { toast } from "sonner";

/**
 * Subscribes to evolution module SSE events.
 * Invalidates relevant queries and shows toasts for critical events.
 */
export function useEvolutionSSE() {
  const qc = useQueryClient();

  useSSE({
    url: "/system/events",
    onEvent: (type, data) => {
      if (!type.startsWith("module:evolution:")) return;

      const subtype = type.replace("module:evolution:", "");
      const d = data as Record<string, unknown> | undefined;
      const instanceName = (d?.instanceName ?? d?.name ?? "") as string;

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
