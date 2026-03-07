import { useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DollarSign } from "lucide-react";
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
import { CostSummaryCards } from "@/components/costs/cost-summary-cards";
import { CostTrendChart } from "@/components/costs/cost-trend-chart";
import { CostByAgentChart } from "@/components/costs/cost-by-agent-chart";
import { CostByOperationChart } from "@/components/costs/cost-by-operation-chart";
import { BudgetAlertList } from "@/components/costs/budget-alert-list";
import { costSummaryQueryOptions, costTrendQueryOptions } from "@/api/costs";
import { agentsQueryOptions } from "@/api/agents";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

interface CostsSearch {
  from?: string;
  to?: string;
  agent?: string;
}

export const Route = createFileRoute("/_authenticated/costs")({
  validateSearch: (search: Record<string, unknown>): CostsSearch => ({
    from: typeof search.from === "string" ? search.from : undefined,
    to: typeof search.to === "string" ? search.to : undefined,
    agent: typeof search.agent === "string" ? search.agent : undefined,
  }),
  component: CostsPage,
});

function CostsPage() {
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

  const { data, isLoading } = useQuery(costSummaryQueryOptions(queryParams));
  const { data: trendData } = useQuery(costTrendQueryOptions(queryParams));
  const { data: agents } = useQuery(agentsQueryOptions());

  const agentNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    (agents ?? []).forEach((a) => {
      map[a.id] = a.slug;
    });
    return map;
  }, [agents]);

  function updateSearch(updates: Partial<CostsSearch>) {
    void navigate({
      search: (prev: CostsSearch) => ({ ...prev, ...updates }),
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Custos"
        description="Visao geral de custos da plataforma"
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="cost-from" className="text-xs">De</Label>
          <Input
            id="cost-from"
            type="date"
            value={from}
            className="w-[160px]"
            onChange={(e) => updateSearch({ from: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cost-to" className="text-xs">Ate</Label>
          <Input
            id="cost-to"
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
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-xl" />
          ))}
        </div>
      ) : !data ? (
        <EmptyState
          icon={<DollarSign />}
          title="Nenhum dado de custo"
          description="Nao ha dados de custo para o periodo selecionado."
        />
      ) : (
        <>
          <CostSummaryCards data={data} />

          {/* Charts */}
          <div className="space-y-4">
            {trendData && trendData.points.length > 0 && (
              <CostTrendChart data={trendData.points} />
            )}

            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {data.byAgent.length > 0 && (
                <CostByAgentChart
                  data={data.byAgent}
                  agentNameMap={agentNameMap}
                />
              )}
              {data.byOperation.length > 0 && (
                <CostByOperationChart
                  data={data.byOperation}
                  totalCostUsd={data.totalCostUsd}
                />
              )}
            </div>
          </div>
        </>
      )}

      {/* Budget Alerts */}
      <BudgetAlertList />
    </div>
  );
}
