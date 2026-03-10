import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";
import { evolutionHealthQuery } from "@/api/evolution";
import { cn } from "@/lib/utils";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 1000) return "agora";
  if (diff < 60_000) return `ha ${Math.floor(diff / 1000)}s`;
  if (diff < 3600_000) return `ha ${Math.floor(diff / 60_000)}min`;
  return `ha ${Math.floor(diff / 3600_000)}h`;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  online: { label: "Online", className: "bg-chart-2/15 text-chart-2" },
  unknown: { label: "Verificando", className: "bg-chart-4/15 text-chart-4" },
  offline: { label: "Indisponivel", className: "bg-destructive/15 text-destructive" },
};

export function ApiHealthCard() {
  const { data: health, isFetching, isError } = useQuery(evolutionHealthQuery);

  const apiState = !health && isError ? "offline" : (health?.apiState ?? "unknown");
  const config = statusConfig[apiState] ?? statusConfig.offline;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Evolution API</CardTitle>
        <Activity className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={cn("flex items-center gap-3", isFetching && !health && !isError && "animate-pulse")}>
          <Badge variant="secondary" className={cn("font-medium", config.className)}>
            {config.label}
          </Badge>
          {!health && isError ? (
            <span className="text-sm text-destructive">Falha ao consultar o backbone</span>
          ) : (
            <>
              {health?.lastProbe?.responseTimeMs != null && (
                <span className="text-sm text-muted-foreground">{health.lastProbe.responseTimeMs}ms</span>
              )}
              {health?.lastProbe?.timestamp && (
                <span className="text-sm text-muted-foreground">{timeAgo(health.lastProbe.timestamp)}</span>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
