import { useEffect, useRef, useCallback, useState } from "react";
import { useAuthStore } from "@/lib/auth";

interface UseSSEOptions {
  url: string;
  enabled?: boolean;
  onEvent?: (event: string, data: unknown) => void;
}

export function useSSE({ url, enabled = true, onEvent }: UseSSEOptions) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<unknown>(null);
  const esRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
    }

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
      // Auto-reconnect after 3s
      setTimeout(() => {
        if (enabled) connect();
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

    // Listen for named events
    for (const eventType of ["connected", "heartbeat:status", "channel:message", "registry:adapters", "job:status", "ping"]) {
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
  }, [url, enabled]);

  useEffect(() => {
    if (!enabled) return;
    connect();
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connect, enabled]);

  const disconnect = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setConnected(false);
  }, []);

  return { connected, lastEvent, disconnect };
}
