import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Download, ChevronRight } from "lucide-react";
import {
  agentRatingsSummaryQueryOptions,
  agentRatingsListQueryOptions,
  exportGoldenSet,
} from "@/api/ratings";
import { agentQueryOptions } from "@/api/agents";
import { ApprovalGauge } from "@/components/ratings/approval-gauge";
import { RatingsTrendChart } from "@/components/ratings/ratings-trend-chart";
import { RatingsCategoryChart } from "@/components/ratings/ratings-category-chart";
import { RatingsTable } from "@/components/ratings/ratings-table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/agents/$id/ratings")({
  component: AgentRatingsPage,
});

type PeriodOption = "7" | "30" | "90";
type RatingFilter = "all" | "up" | "down";

function AgentRatingsPage() {
  const { id } = Route.useParams();
  const [period, setPeriod] = useState<PeriodOption>("30");
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");

  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const from = new Date(now.getTime() - Number(period) * 86400_000)
    .toISOString()
    .slice(0, 10);

  const { data: agent } = useQuery(agentQueryOptions(id));
  const { data: summary, isLoading: summaryLoading } = useQuery(
    agentRatingsSummaryQueryOptions(id, { from, to }),
  );
  const { data: list, isLoading: listLoading } = useQuery(
    agentRatingsListQueryOptions(id, {
      from,
      to,
      rating: ratingFilter === "all" ? undefined : ratingFilter,
      limit: 50,
    }),
  );

  const exportMutation = useMutation({
    mutationFn: () => exportGoldenSet(id, { rating: "down", from, to }),
    onSuccess: (data) => {
      alert(`Golden set exportado: ${data.casesExported} casos em ${data.path}`);
    },
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="space-y-1">
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/agents" className="hover:text-foreground transition-colors">
            Agentes
          </Link>
          <ChevronRight className="size-3.5" />
          <Link
            to="/agents/$id"
            params={{ id }}
            className="hover:text-foreground transition-colors"
          >
            {agent?.slug ?? id}
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="text-foreground font-medium">Ratings</span>
        </nav>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/agents/$id"
              params={{ id }}
              className="inline-flex size-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight">Ratings</h1>
          </div>
          <div className="flex items-center gap-2">
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
            <Select value={ratingFilter} onValueChange={(v) => setRatingFilter(v as RatingFilter)}>
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="up">Positivos</SelectItem>
                <SelectItem value="down">Negativos</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
            >
              <Download className="size-3.5" />
              Exportar Golden Set
            </Button>
          </div>
        </div>
      </div>

      {/* Summary row */}
      {summaryLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48 sm:col-span-2" />
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ApprovalGauge
            approvalRate={summary.approvalRate}
            total={summary.total}
            upCount={summary.upCount}
            downCount={summary.downCount}
          />
          <div className="sm:col-span-2">
            <RatingsTrendChart trend={summary.trend} />
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Sem dados de summary.</p>
      )}

      {/* Charts row */}
      {summary && (
        <RatingsCategoryChart byCategory={summary.byCategory} />
      )}

      {/* Ratings table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Ratings Recentes
            {list && (
              <span className="ml-2 font-normal text-muted-foreground">
                ({list.total} total)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {listLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : list ? (
            <RatingsTable items={list.items} />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
