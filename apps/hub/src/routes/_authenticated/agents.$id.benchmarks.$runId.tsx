import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
} from "lucide-react";
import {
  benchmarkRunDetailQueryOptions,
  benchmarkCasesQueryOptions,
  type BenchmarkCase,
} from "@/api/benchmarks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type BenchmarkRunSearch = { case?: string };

export const Route = createFileRoute(
  "/_authenticated/agents/$id/benchmarks/$runId",
)({
  staticData: { title: "Benchmark" },
  validateSearch: (search: Record<string, unknown>): BenchmarkRunSearch => ({
    case: typeof search.case === "string" ? search.case : undefined,
  }),
  component: BenchmarkRunPage,
});

// ── Helpers ────────────────────────────────────────────────────────────────

function ScoreCell({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted-foreground">—</span>;
  const pct = Math.round(score * 100);
  const color =
    pct >= 80
      ? "text-green-700 dark:text-green-400"
      : pct >= 50
        ? "text-yellow-700 dark:text-yellow-400"
        : "text-red-700 dark:text-red-400";
  return <span className={cn("font-medium tabular-nums", color)}>{pct}%</span>;
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta == null) return <Badge variant="outline">—</Badge>;
  const pct = (delta * 100).toFixed(1);
  if (delta > 0.005) {
    return (
      <Badge className="bg-green-500/15 text-green-700 border-green-500/30 gap-1">
        <TrendingUp className="size-3" />+{pct}%
      </Badge>
    );
  }
  if (delta < -0.005) {
    return (
      <Badge className="bg-red-500/15 text-red-700 border-red-500/30 gap-1">
        <TrendingDown className="size-3" />
        {pct}%
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <Minus className="size-3" />
      {pct}%
    </Badge>
  );
}

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

// ── Case detail modal ──────────────────────────────────────────────────────

function CaseDetailModal({
  caseData,
  open,
  onOpenChange,
}: {
  caseData: BenchmarkCase | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!caseData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do caso — {caseData.caseId}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 text-sm">
          {/* Input */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Input
            </p>
            <pre className="whitespace-pre-wrap rounded-md bg-muted/60 px-3 py-2 text-xs leading-relaxed">
              {caseData.input}
            </pre>
          </div>

          {/* Expected */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Expected
            </p>
            <pre className="whitespace-pre-wrap rounded-md bg-muted/60 px-3 py-2 text-xs leading-relaxed">
              {caseData.expected}
            </pre>
          </div>

          {/* Responses side by side */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Resposta (versao anterior)
                </p>
                <ScoreCell score={caseData.scoreBefore} />
              </div>
              <pre className="whitespace-pre-wrap rounded-md bg-muted/60 px-3 py-2 text-xs leading-relaxed min-h-16">
                {caseData.responseBefore ?? (
                  <span className="text-muted-foreground italic">
                    Sem resposta anterior
                  </span>
                )}
              </pre>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Resposta (versao atual)
                </p>
                <ScoreCell score={caseData.scoreAfter} />
              </div>
              <pre className="whitespace-pre-wrap rounded-md bg-muted/60 px-3 py-2 text-xs leading-relaxed min-h-16">
                {caseData.responseAfter}
              </pre>
            </div>
          </div>

          {/* Delta */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Delta:</span>
            <DeltaBadge delta={caseData.delta} />
          </div>

          {/* Judge reasoning */}
          {caseData.judgeReasoning && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Reasoning do judge
              </p>
              <div className="rounded-md border bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2 text-xs leading-relaxed text-foreground">
                {caseData.judgeReasoning}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

function BenchmarkRunPage() {
  const { id: agentId, runId } = Route.useParams();
  const { case: caseId } = Route.useSearch();
  const navigate = useNavigate();

  const { data: run, isLoading: runLoading } = useQuery(
    benchmarkRunDetailQueryOptions(agentId, runId),
  );
  const { data: casesData, isLoading: casesLoading } = useQuery(
    benchmarkCasesQueryOptions(agentId, runId),
  );

  function goBack() {
    navigate({
      to: "/agents/$id",
      params: { id: agentId },
      search: { tab: "benchmarks" },
    });
  }

  if (runLoading) {
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
        <p className="text-muted-foreground">Benchmark run nao encontrado.</p>
        <Button variant="outline" size="sm" onClick={goBack}>
          <ArrowLeft className="mr-1.5 size-4" />
          Voltar
        </Button>
      </div>
    );
  }

  const cases = casesData?.cases ?? [];
  const selectedCase = caseId ? cases.find((c) => c.caseId === caseId) ?? null : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={goBack} className="-ml-1">
          <ArrowLeft className="mr-1.5 size-4" />
          Benchmarks
        </Button>
        <span className="text-muted-foreground">/</span>
        <div className="flex items-center gap-2">
          <BarChart3 className="size-4 text-muted-foreground" />
          <h1 className="text-lg font-semibold">
            v{run.versionTo}
            {run.versionFrom && (
              <span className="text-sm font-normal text-muted-foreground ml-1">
                ← v{run.versionFrom}
              </span>
            )}
          </h1>
        </div>
      </div>

      {/* Regression alert */}
      {run.regression && (
        <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 dark:border-red-700/50 dark:bg-red-950/30">
          <TrendingDown className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
          <p className="text-sm text-red-800 dark:text-red-300">
            <span className="font-medium">Regressao detectada.</span> O score
            caiu{" "}
            {run.delta != null
              ? Math.abs(run.delta * 100).toFixed(1) + "%"
              : ""}{" "}
            em relacao a versao anterior.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <StatCard
          label="Score antes"
          value={<ScoreCell score={run.scoreBefore} />}
        />
        <StatCard
          label="Score depois"
          value={<ScoreCell score={run.scoreAfter} />}
        />
        <StatCard label="Delta" value={<DeltaBadge delta={run.delta} />} />
        <StatCard
          label="Total de casos"
          value={run.casesTotal ?? "—"}
          icon={<BarChart3 className="size-3.5" />}
        />
        <StatCard
          label="Aprovados / Falhos"
          value={
            <span>
              <span className="text-green-600 dark:text-green-400">
                {run.casesPassed ?? "—"}
              </span>
              {" / "}
              <span className="text-red-600 dark:text-red-400">
                {run.casesFailed ?? "—"}
              </span>
            </span>
          }
          icon={
            <span className="flex gap-1">
              <CheckCircle2 className="size-3.5 text-green-600 dark:text-green-400" />
              <XCircle className="size-3.5 text-red-600 dark:text-red-400" />
            </span>
          }
        />
      </div>

      {/* Status banner */}
      {run.status !== "done" && (
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {run.status === "running"
            ? "A execucao esta em andamento. Recarregue para ver os resultados."
            : run.status === "pending"
              ? "Aguardando execucao em background..."
              : `Status: ${run.status}`}
        </div>
      )}

      {/* Cases table */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium">
          Casos individuais
          {casesData && (
            <span className="ml-1.5 text-muted-foreground font-normal">
              ({casesData.total})
            </span>
          )}
        </h2>

        {casesLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        ) : cases.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {run.status === "done"
              ? "Nenhum caso disponivel."
              : "Casos serao exibidos apos a conclusao da run."}
          </p>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Input</TableHead>
                  <TableHead className="text-right">Score antes</TableHead>
                  <TableHead className="text-right">Score depois</TableHead>
                  <TableHead className="text-right">Delta</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="max-w-xs">
                      <span className="line-clamp-2 text-xs">{c.input}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <ScoreCell score={c.scoreBefore} />
                    </TableCell>
                    <TableCell className="text-right">
                      <ScoreCell score={c.scoreAfter} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DeltaBadge delta={c.delta} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => navigate({ search: { case: c.caseId } })}
                      >
                        <Eye className="mr-1 size-3.5" />
                        Ver detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Case detail modal */}
      <CaseDetailModal
        caseData={selectedCase}
        open={!!caseId && !!selectedCase}
        onOpenChange={(open) => { if (!open) navigate({ search: {} }); }}
      />
    </div>
  );
}
