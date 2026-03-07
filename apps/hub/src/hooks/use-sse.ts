import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/lib/auth";
import { queryClient } from "@/lib/query-client";

export interface SystemEvent {
  type: string;
  data?: Record<string, unknown>;
}

interface UseSSEOptions {
  enabled?: boolean;
}

interface UseSSEResult {
  connected: boolean;
  lastEvent: SystemEvent | null;
}

const MIN_DELAY = 1_000;
const MAX_DELAY = 30_000;

export function useSSE(options?: UseSSEOptions): UseSSEResult {
  const enabled = options?.enabled ?? true;
  const token = useAuthStore((s) => s.token);
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SystemEvent | null>(null);
  const retryDelay = useRef(MIN_DELAY);

  useEffect(() => {
    if (!enabled || !token) {
      setConnected(false);
      return;
    }

    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    function connect() {
      if (disposed) return;

      es = new EventSource(`/api/v1/ai/system/events?token=${encodeURIComponent(token!)}`);

      es.onopen = () => {
        retryDelay.current = MIN_DELAY;
        setConnected(true);
      };

      es.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(ev.data) as SystemEvent;
          setLastEvent(parsed);
          invalidateByEvent(parsed);
        } catch {
          // ignore non-JSON messages
        }
      };

      es.onerror = () => {
        es?.close();
        setConnected(false);

        if (!disposed) {
          const delay = retryDelay.current;
          retryDelay.current = Math.min(delay * 2, MAX_DELAY);
          retryTimer = setTimeout(connect, delay);
        }
      };
    }

    connect();

    return () => {
      disposed = true;
      es?.close();
      if (retryTimer) clearTimeout(retryTimer);
      setConnected(false);
    };
  }, [enabled, token]);

  return { connected, lastEvent };
}

function invalidateByEvent(event: SystemEvent) {
  switch (event.type) {
    case "heartbeat:status": {
      const agentId = event.data?.agentId as string | undefined;
      if (agentId) {
        queryClient.invalidateQueries({ queryKey: ["agents", agentId, "stats"] });
      }
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      break;
    }
    case "registry:adapters":
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      break;
    case "channel:message":
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      break;
    case "job:status":
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      break;
  }
}
