import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, XCircle, FlaskConical } from "lucide-react";
import { evalRunDetailQueryOptions } from "@/api/evaluation";
import { EvalResultTable } from "@/components/agents/eval-result-table";
import { EvalScoreBadge } from "@/components/agents/eval-score-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute(
  "/_authenticated/agents/$id/eval-runs/$runId",
)({
  component: EvalRunPage,
});

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

function EvalRunPage() {
  const { id: agentId, runId } = Route.useParams();
  const navigate = useNavigate();

  const { data: run, isLoading } = useQuery(
    evalRunDetailQueryOptions(agentId, runId),
  );

  function goBack() {
    navigate({
      to: "/agents/$id",
      params: { id: agentId },
      search: { tab: "evaluation" },
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Execucao nao encontrada.</p>
        <Button variant="outline" size="sm" onClick={goBack}>
          <ArrowLeft className="mr-1.5 size-4" />
          Voltar
        </Button>
      </div>
    );
  }

  const scorePercent =
    run.score_avg != null ? Math.round(run.score_avg * 100) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={goBack} className="-ml-1">
          <ArrowLeft className="mr-1.5 size-4" />
          Avaliacao
        </Button>
        <span className="text-muted-foreground">/</span>
        <div className="flex items-center gap-2">
          <FlaskConical className="size-4 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Run #{run.id}</h1>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Score Geral"
          value={
            <EvalScoreBadge score={run.score_avg ?? null} />
          }
        />
        <StatCard
          label="Total de Casos"
          value={run.total_cases}
          icon={<FlaskConical className="size-3.5" />}
        />
        <StatCard
          label="Aprovados"
          value={
            <span className="text-green-600 dark:text-green-400">
              {run.passed}
            </span>
          }
          icon={<CheckCircle2 className="size-3.5 text-green-600 dark:text-green-400" />}
        />
        <StatCard
          label="Reprovados"
          value={
            <span className="text-red-600 dark:text-red-400">
              {run.failed}
            </span>
          }
          icon={<XCircle className="size-3.5 text-red-600 dark:text-red-400" />}
        />
      </div>

      {/* Status banner for non-done runs */}
      {run.status !== "done" && (
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {run.status === "running"
            ? "A execucao esta em andamento. Recarregue para ver os resultados."
            : `Status: ${run.status}`}
        </div>
      )}

      {/* Result table */}
      <EvalResultTable run={run} agentId={agentId} />

      {/* Score summary footer */}
      {scorePercent != null && (
        <p className="text-xs text-muted-foreground">
          Score medio: {scorePercent}% &mdash; {run.passed} de {run.total_cases} casos aprovados
        </p>
      )}
    </div>
  );
}
