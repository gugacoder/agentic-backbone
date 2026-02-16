import { useRef, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSSE } from "@/hooks/use-sse";

interface EventEntry {
  id: string;
  type: string;
  timestamp: Date;
  data?: unknown;
}

const eventConfig: Record<string, { label: string; className: string }> = {
  "instance-connected": { label: "Conectou", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  "instance-disconnected": { label: "Desconectou", className: "bg-red-500/15 text-red-700 dark:text-red-400" },
  "instance-reconnecting": { label: "Reconectando", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  "instance-unstable": { label: "Instavel", className: "bg-orange-500/15 text-orange-700 dark:text-orange-400" },
  "instance-prolonged-offline": { label: "Offline prolongado", className: "bg-red-500/15 text-red-700 dark:text-red-400" },
  "instance-discovered": { label: "Descoberta", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  "instance-removed": { label: "Removida", className: "bg-muted text-muted-foreground" },
  "action-success": { label: "Acao OK", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  "action-failed": { label: "Acao falhou", className: "bg-red-500/15 text-red-700 dark:text-red-400" },
  "action-exhausted": { label: "Tentativas esgotadas", className: "bg-red-500/15 text-red-700 dark:text-red-400" },
};

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return `ha ${Math.max(1, Math.floor(diff / 1000))}s`;
  if (diff < 3600_000) return `ha ${Math.floor(diff / 60_000)}min`;
  return `ha ${Math.floor(diff / 3600_000)}h`;
}

interface InstanceEventFeedProps {
  instanceName: string;
}

export function InstanceEventFeed({ instanceName }: InstanceEventFeedProps) {
  const eventsRef = useRef<EventEntry[]>([]);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [, setTick] = useState(0);

  // Refresh timestamps every 10s
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  useSSE({
    url: "/system/events",
    onEvent: (type, data) => {
      // Filter events for this instance
      const d = data as Record<string, unknown> | undefined;
      if (!d) return;

      // Events from the evolution module have instanceName in data
      const eventInstance = d.instanceName ?? d.name;
      if (eventInstance !== instanceName) return;

      // Extract the event subtype (e.g. "instance-connected" from "module:evolution:instance-connected")
      const eventType = (d.event as string) ?? type;
      const subtype = eventType.replace(/^module:evolution:/, "");

      if (!eventConfig[subtype]) return;

      const entry: EventEntry = {
        id: `${Date.now()}-${Math.random()}`,
        type: subtype,
        timestamp: new Date(),
        data: d,
      };

      eventsRef.current = [entry, ...eventsRef.current].slice(0, 50);
      setEvents([...eventsRef.current]);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Eventos Recentes</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhum evento desde o carregamento da pagina.
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {events.map((evt) => {
              const cfg = eventConfig[evt.type] ?? { label: evt.type, className: "bg-muted text-muted-foreground" };
              return (
                <div key={evt.id} className="flex items-center gap-3 text-sm py-1">
                  <span className="text-muted-foreground text-xs w-16 shrink-0">
                    {timeAgo(evt.timestamp)}
                  </span>
                  <Badge variant="secondary" className={cn("font-medium text-xs", cfg.className)}>
                    {cfg.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
