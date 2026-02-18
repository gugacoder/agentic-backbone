import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RefreshCw, RotateCcw, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EvolutionInstance } from "@/api/evolution";
import { useReconnectInstance, useRestartInstance, friendlyMessage } from "@/api/evolution";
import type { InstanceAlerts } from "@/hooks/use-evolution-sse";
import { stateConfig, timeAgo } from "./evolution-utils";
import { toast } from "sonner";

interface InstanceCardProps {
  instance: EvolutionInstance;
  alerts?: InstanceAlerts;
  onDelete: (name: string) => void;
}

export function InstanceCard({ instance, alerts, onDelete }: InstanceCardProps) {
  const [, setTick] = useState(0);
  const reconnect = useReconnectInstance();
  const restart = useRestartInstance();

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const cfg = stateConfig[instance.state] ?? stateConfig.close;
  const isOnline = instance.state === "open";
  const isUnstable = alerts?.unstable.has(instance.instanceName);

  function handleReconnect() {
    reconnect.mutate(instance.instanceName, {
      onSuccess: (result) => {
        if (!result.ok) {
          toast.error(friendlyMessage(result.error ?? ""));
          return;
        }
        toast.success(`Reconexao solicitada para ${instance.instanceName}`);
      },
      onError: (err) => toast.error(`Falha ao reconectar: ${err.message}`),
    });
  }

  function handleRestart() {
    restart.mutate(instance.instanceName, {
      onSuccess: (result) => {
        if (!result.ok) {
          toast.error(friendlyMessage(result.error ?? ""));
          return;
        }
        toast.success(`Reinicio solicitado para ${instance.instanceName}`);
      },
      onError: (err) => toast.error(`Falha ao reiniciar: ${err.message}`),
    });
  }

  return (
    <Card className="group relative">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <Link
            to="/conectividade/whatsapp/$name"
            params={{ name: instance.instanceName }}
            search={{ tab: "status" }}
          >
            <CardTitle className="text-base hover:underline flex items-center gap-1.5">
              {instance.instanceName}
              {isUnstable && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertTriangle className="h-4 w-4 text-chart-4 shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent>Conexao instavel — multiplas reconexoes recentes</TooltipContent>
                </Tooltip>
              )}
            </CardTitle>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onDelete(instance.instanceName)}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {instance.owner ?? "Nao vinculado"}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={cn("font-medium", cfg.className)}>
            {cfg.label}
          </Badge>
          <span className="text-xs text-muted-foreground">{timeAgo(instance.since)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={isOnline || reconnect.isPending}
                onClick={handleReconnect}
              >
                {reconnect.isPending && reconnect.variables === instance.instanceName
                  ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  : <RefreshCw className="h-3 w-3 mr-1" />}
                Reconectar
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reconectar</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={isOnline || restart.isPending}
                onClick={handleRestart}
              >
                {restart.isPending && restart.variables === instance.instanceName
                  ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  : <RotateCcw className="h-3 w-3 mr-1" />}
                Reiniciar
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reiniciar</TooltipContent>
          </Tooltip>
        </div>
      </CardContent>
    </Card>
  );
}
