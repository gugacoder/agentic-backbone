import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EvolutionInstance } from "@/api/evolution";

const stateConfig: Record<string, { label: string; className: string }> = {
  open: { label: "Online", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  connecting: { label: "Conectando", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  close: { label: "Offline", className: "bg-red-500/15 text-red-700 dark:text-red-400" },
};

function timeAgo(ts: number | undefined): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 60_000) return `ha ${Math.max(1, Math.floor(diff / 1000))}s`;
  if (diff < 3600_000) return `ha ${Math.floor(diff / 60_000)}min`;
  if (diff < 86400_000) return `ha ${Math.floor(diff / 3600_000)}h`;
  return `ha ${Math.floor(diff / 86400_000)}d`;
}

function formatDate(ts: number | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("pt-BR");
}

interface InstanceStatusCardProps {
  instance: EvolutionInstance;
}

export function InstanceStatusCard({ instance }: InstanceStatusCardProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const cfg = stateConfig[instance.state] ?? stateConfig.close;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Estado Atual</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className={cn("font-medium text-base px-3 py-1", cfg.className)}>
            {cfg.label}
          </Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Desde</p>
            <p className="font-medium">
              {formatDate(instance.since)} ({timeAgo(instance.since)})
            </p>
          </div>
          {instance.previousState && (
            <div>
              <p className="text-muted-foreground">Estado anterior</p>
              <p className="font-medium">
                {stateConfig[instance.previousState]?.label ?? instance.previousState}
              </p>
            </div>
          )}
          {instance.profileName && (
            <div>
              <p className="text-muted-foreground">Perfil</p>
              <p className="font-medium">{instance.profileName}</p>
            </div>
          )}
          <div>
            <p className="text-muted-foreground">Numero</p>
            <p className="font-medium">{instance.owner ?? "Nao vinculado"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
