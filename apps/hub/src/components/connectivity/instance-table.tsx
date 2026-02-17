import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, RefreshCw, RotateCcw, Eye, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EvolutionInstance } from "@/api/evolution";
import { useReconnectInstance, useRestartInstance, friendlyMessage } from "@/api/evolution";
import type { InstanceAlerts } from "@/hooks/use-evolution-sse";
import { toast } from "sonner";

interface InstanceTableProps {
  instances: EvolutionInstance[];
  variant: "monitor" | "instances";
  onDelete?: (name: string) => void;
  alerts?: InstanceAlerts;
}

const stateOrder: Record<string, number> = { close: 0, connecting: 1, open: 2 };

const stateConfig: Record<string, { label: string; className: string }> = {
  open: { label: "Online", className: "bg-chart-2/15 text-chart-2" },
  connecting: { label: "Conectando", className: "bg-chart-4/15 text-chart-4" },
  close: { label: "Offline", className: "bg-destructive/15 text-destructive" },
};

function timeAgo(ts: number | undefined): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 60_000) return `ha ${Math.max(1, Math.floor(diff / 1000))}s`;
  if (diff < 3600_000) return `ha ${Math.floor(diff / 60_000)}min`;
  if (diff < 86400_000) return `ha ${Math.floor(diff / 3600_000)}h`;
  return `ha ${Math.floor(diff / 86400_000)}d`;
}

function sortByCriticality(instances: EvolutionInstance[]): EvolutionInstance[] {
  return [...instances].sort((a, b) => {
    const orderDiff = (stateOrder[a.state] ?? 2) - (stateOrder[b.state] ?? 2);
    if (orderDiff !== 0) return orderDiff;
    // Within same state, longer duration first (lower since = older = longer duration)
    return (a.since ?? Date.now()) - (b.since ?? Date.now());
  });
}

export function InstanceTable({ instances, variant, onDelete, alerts }: InstanceTableProps) {
  const [, setTick] = useState(0);
  const reconnect = useReconnectInstance();
  const restart = useRestartInstance();

  // Update relative times every 10 seconds
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const sorted = sortByCriticality(instances);

  function handleReconnect(name: string) {
    reconnect.mutate(name, {
      onSuccess: (result) => {
        if (!result.ok) {
          toast.error(friendlyMessage(result.error ?? ""));
          return;
        }
        toast.success(`Reconexao solicitada para ${name}`);
      },
      onError: (err) => toast.error(`Falha ao reconectar ${name}: ${err.message}`),
    });
  }

  function handleRestart(name: string) {
    restart.mutate(name, {
      onSuccess: (result) => {
        if (!result.ok) {
          toast.error(friendlyMessage(result.error ?? ""));
          return;
        }
        toast.success(`Reinicio solicitado para ${name}`);
      },
      onError: (err) => toast.error(`Falha ao reiniciar ${name}: ${err.message}`),
    });
  }

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Nenhuma instancia encontrada.
      </p>
    );
  }

  if (variant === "monitor") {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead className="hidden md:table-cell">Numero</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Duracao</TableHead>
            <TableHead className="text-right">Acoes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((inst) => {
            const cfg = stateConfig[inst.state] ?? stateConfig.close;
            const isOnline = inst.state === "open";
            const isUnstable = alerts?.unstable.has(inst.instanceName);
            const isProlongedOffline = alerts?.prolongedOffline.has(inst.instanceName);
            return (
              <TableRow key={inst.instanceName}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-1.5">
                    {inst.instanceName}
                    {isUnstable && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertTriangle className="h-4 w-4 text-chart-4 shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent>Conexao instavel — multiplas reconexoes recentes</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {inst.owner ?? "Nao vinculado"}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={cn("font-medium", cfg.className)}>
                    {cfg.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    {timeAgo(inst.since)}
                    {isProlongedOffline && (
                      <Badge variant="secondary" className="bg-destructive/15 text-destructive text-xs">
                        Offline prolongado
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {/* Desktop: inline buttons */}
                  <div className="hidden md:flex items-center justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={isOnline || reconnect.isPending}
                          onClick={() => handleReconnect(inst.instanceName)}
                        >
                          {reconnect.isPending && reconnect.variables === inst.instanceName
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <RefreshCw className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Reconectar</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={isOnline || restart.isPending}
                          onClick={() => handleRestart(inst.instanceName)}
                        >
                          {restart.isPending && restart.variables === inst.instanceName
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <RotateCcw className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Reiniciar</TooltipContent>
                    </Tooltip>
                  </div>
                  {/* Mobile: dropdown menu */}
                  <div className="md:hidden">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={isOnline}
                          onClick={() => handleReconnect(inst.instanceName)}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Reconectar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={isOnline}
                          onClick={() => handleRestart(inst.instanceName)}
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Reiniciar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  }

  // variant === "instances"
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead className="hidden md:table-cell">Numero</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="hidden md:table-cell">Perfil</TableHead>
          <TableHead className="text-right">Acoes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((inst) => {
          const cfg = stateConfig[inst.state] ?? stateConfig.close;
          return (
            <TableRow key={inst.instanceName}>
              <TableCell className="font-medium">
                <Link
                  to="/conectividade/whatsapp/$name"
                  params={{ name: inst.instanceName }}
                  search={{ tab: "status" }}
                  className="hover:underline"
                >
                  {inst.instanceName}
                </Link>
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">
                {inst.owner ?? "Nao vinculado"}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className={cn("font-medium", cfg.className)}>
                  {cfg.label}
                </Badge>
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">
                {inst.profileName ?? "—"}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link
                        to="/conectividade/whatsapp/$name"
                        params={{ name: inst.instanceName }}
                        search={{ tab: "status" }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Ver detalhes
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={inst.state === "open"}
                      onClick={() => handleReconnect(inst.instanceName)}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reconectar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={inst.state === "open"}
                      onClick={() => handleRestart(inst.instanceName)}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reiniciar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => onDelete?.(inst.instanceName)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
