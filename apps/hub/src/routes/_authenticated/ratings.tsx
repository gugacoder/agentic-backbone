import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { globalRatingsQueryOptions } from "@/api/ratings";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/ratings")({
  component: GlobalRatingsDashboard,
});

type PeriodOption = "7" | "30" | "90";

function GlobalRatingsDashboard() {
  const [period, setPeriod] = useState<PeriodOption>("30");
  const [channelFilter, setChannelFilter] = useState<string>("all");

  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const from = new Date(now.getTime() - Number(period) * 86400_000)
    .toISOString()
    .slice(0, 10);

  const { data, isLoading } = useQuery(
    globalRatingsQueryOptions({
      from,
      to,
      channelType: channelFilter === "all" ? undefined : channelFilter,
    }),
  );

  const alertAgents = data?.agents.filter((a) => a.alert) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Ratings Global</h1>
          <p className="text-sm text-muted-foreground">
            Comparativo de qualidade percebida entre todos os agentes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={channelFilter} onValueChange={(v) => setChannelFilter(v ?? "all")}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os canais</SelectItem>
              <SelectItem value="web">Web</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="slack">Slack</SelectItem>
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodOption)}>
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Global summary cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Avaliações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{data.globalTotal.toLocaleString("pt-BR")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Taxa de Aprovação Global
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={`text-3xl font-bold ${
                  data.globalApprovalRate >= 0.8
                    ? "text-green-600"
                    : data.globalApprovalRate >= 0.6
                      ? "text-yellow-600"
                      : "text-destructive"
                }`}
              >
                {Math.round(data.globalApprovalRate * 100)}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Agentes em Alerta (&lt;70% / 24h)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={`text-3xl font-bold ${alertAgents.length > 0 ? "text-destructive" : "text-green-600"}`}
              >
                {alertAgents.length}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Alert banner */}
      {alertAgents.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="text-sm">
            <span className="font-medium text-destructive">Agentes com aprovação abaixo de 70%</span>
            <span className="text-muted-foreground"> nas últimas 24h: </span>
            <span className="font-medium">
              {alertAgents.map((a) => a.agentId).join(", ")}
            </span>
          </div>
        </div>
      )}

      {/* Agents table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Comparativo por Agente
            {data && (
              <span className="ml-2 font-normal text-muted-foreground">
                ({data.agents.length} agentes)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : data?.agents.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum dado de rating no período selecionado.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agente</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Positivos</TableHead>
                  <TableHead className="text-right">Negativos</TableHead>
                  <TableHead className="text-right">Aprovação</TableHead>
                  <TableHead className="text-center">Tendência</TableHead>
                  <TableHead>Última Avaliação</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.agents.map((agent) => (
                  <TableRow
                    key={agent.agentId}
                    className={agent.alert ? "bg-destructive/5" : undefined}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {agent.alert && (
                          <AlertTriangle className="size-3.5 text-destructive" />
                        )}
                        <span>{agent.agentId}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {agent.total.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-green-600">
                      {agent.upCount.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">
                      {agent.downCount.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className={`tabular-nums ${
                          agent.approvalRate >= 0.8
                            ? "border-green-500 text-green-600"
                            : agent.approvalRate >= 0.6
                              ? "border-yellow-500 text-yellow-600"
                              : "border-destructive text-destructive"
                        }`}
                      >
                        {Math.round(agent.approvalRate * 100)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <TrendIcon trend={agent.trend} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(agent.lastRatedAt).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <Link
                        to="/agents/$id/ratings"
                        params={{ id: agent.agentId }}
                        className="text-xs text-primary underline-offset-2 hover:underline"
                      >
                        Ver detalhes
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up") {
    return <TrendingUp className="mx-auto size-4 text-green-600" />;
  }
  if (trend === "down") {
    return <TrendingDown className="mx-auto size-4 text-destructive" />;
  }
  return <Minus className="mx-auto size-4 text-muted-foreground" />;
}
