import { useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AnalyticsSummaryCards } from "@/components/analytics/analytics-summary-cards";
import { AnalyticsTrendChart } from "@/components/analytics/analytics-trend-chart";
import { AgentRankingTable } from "@/components/analytics/agent-ranking-table";
import { analyticsOverviewQueryOptions } from "@/api/analytics";
import { agentsQueryOptions } from "@/api/agents";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

interface AnalyticsSearch {
  from?: string;
  to?: string;
  agent?: string;
}

export const Route = createFileRoute("/_authenticated/analytics")({
  validateSearch: (search: Record<string, unknown>): AnalyticsSearch => ({
    from: typeof search.from === "string" ? search.from : undefined,
    to: typeof search.to === "string" ? search.to : undefined,
    agent: typeof search.agent === "string" ? search.agent : undefined,
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();

  const from = search.from ?? daysAgoISO(7);
  const to = search.to ?? todayISO();
  const agentFilter = search.agent ?? "all";

  const queryParams = useMemo(
    () => ({
      from,
      to,
      agentId: agentFilter !== "all" ? agentFilter : undefined,
    }),
    [from, to, agentFilter],
  );

  const { data, isLoading } = useQuery(analyticsOverviewQueryOptions(queryParams));
  const { data: agents } = useQuery(agentsQueryOptions());

  function updateSearch(updates: Partial<AnalyticsSearch>) {
    void navigate({
      search: (prev: AnalyticsSearch) => ({ ...prev, ...updates }),
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Metricas e tendencias da plataforma"
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="analytics-from" className="text-xs">De</Label>
          <Input
            id="analytics-from"
            type="date"
            value={from}
            className="w-[160px]"
            onChange={(e) => updateSearch({ from: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="analytics-to" className="text-xs">Ate</Label>
          <Input
            id="analytics-to"
            type="date"
            value={to}
            className="w-[160px]"
            onChange={(e) => updateSearch({ to: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Agente</Label>
          <Select
            value={agentFilter}
            onValueChange={(v) => updateSearch({ agent: v === "all" ? undefined : v })}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todos os agentes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os agentes</SelectItem>
              {agents?.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.slug}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-xl" />
          ))}
        </div>
      ) : !data ? (
        <EmptyState
          icon={<TrendingUp />}
          title="Nenhum dado de analytics"
          description="Nao ha dados de analytics para o periodo selecionado."
        />
      ) : (
        <>
          <AnalyticsSummaryCards data={data} />
          <AnalyticsTrendChart
            from={from}
            to={to}
            agentId={queryParams.agentId}
          />
          <AgentRankingTable from={from} to={to} />
        </>
      )}
    </div>
  );
}
