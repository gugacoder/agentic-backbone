import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useAuthStore } from "@/lib/auth";

interface UseSSEOptions {
  url: string;
  enabled?: boolean;
  onEvent?: (event: string, data: unknown) => void;
  /** Additional named SSE event types to listen for (beyond the built-in set). */
  additionalEventTypes?: string[];
}

const BUILT_IN_TYPES = ["connected", "heartbeat:status", "channel:message", "registry:adapters", "job:status", "ping"];

export function useSSE({ url, enabled = true, onEvent, additionalEventTypes = [] }: UseSSEOptions) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<unknown>(null);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  // Stabilize the array reference — only change when the actual values change
  const eventTypesKey = additionalEventTypes.join(",");
  const stableEventTypes = useMemo(() => additionalEventTypes, [eventTypesKey]);

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
    }
    clearTimeout(reconnectTimer.current);

    const token = useAuthStore.getState().token;
    const fullUrl = token
      ? `/api${url}?token=${encodeURIComponent(token)}`
      : `/api${url}`;
    const es = new EventSource(fullUrl);
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => {
      setConnected(false);
      es.close();
      reconnectTimer.current = setTimeout(() => {
        if (esRef.current === es) connect();
      }, 3000);
    };

    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        setLastEvent(data);
        onEventRef.current?.(evt.type ?? "message", data);
      } catch {
        // ignore non-JSON
      }
    };

    for (const eventType of [...BUILT_IN_TYPES, ...stableEventTypes]) {
      es.addEventListener(eventType, (evt) => {
        try {
          const data = JSON.parse((evt as MessageEvent).data);
          setLastEvent(data);
          onEventRef.current?.(eventType, data);
        } catch {
          // ignore
        }
      });
    }
  }, [url, stableEventTypes]);

  useEffect(() => {
    if (!enabled) return;
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connect, enabled]);

  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimer.current);
    esRef.current?.close();
    esRef.current = null;
    setConnected(false);
  }, []);

  return { connected, lastEvent, disconnect };
}
