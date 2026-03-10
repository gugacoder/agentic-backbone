import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import { agentQueryOptions } from "@/api/agents";
import { queryClient } from "@/lib/query-client";
import { agentRatingsSummaryQueryOptions } from "@/api/ratings";
import { benchmarkLatestQueryOptions } from "@/api/benchmarks";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/status-badge";

export const Route = createFileRoute("/_authenticated/agents/$id")({
  loader: async ({ params }) => {
    const agent = await queryClient.ensureQueryData(agentQueryOptions(params.id));
    return { title: agent.slug, description: "Agente" };
  },
  component: AgentLayout,
});

function AgentLayout() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: agent } = useQuery(agentQueryOptions(id));
  const { data: ratingsSummary } = useQuery(agentRatingsSummaryQueryOptions(id));
  const { data: latestBenchmark } = useQuery(benchmarkLatestQueryOptions(id));

  // loader ensures agent exists before render
  if (!agent) return null;

  const isActive = agent.enabled && agent.heartbeatEnabled;

  return (
    <div className="space-y-6">
      {/* Status badges — compartilhado por todas as sub-rotas */}
      <div className="flex items-center gap-3 flex-wrap">
        <StatusBadge status={isActive ? "active" : "inactive"} />
        {ratingsSummary && ratingsSummary.total > 0 && (
          <Link
            to="/agents/$id/ratings"
            params={{ id }}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors hover:opacity-80",
              ratingsSummary.approvalRate >= 0.8
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                : ratingsSummary.approvalRate >= 0.6
                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                  : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
            )}
          >
            {Math.round(ratingsSummary.approvalRate * 100)}% aprovacao
          </Link>
        )}
        {latestBenchmark == null ? (
          <button
            onClick={() => navigate({ to: "/agents/$id", params: { id }, search: { tab: "benchmarks" } })}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:opacity-80 transition-opacity"
          >
            <BarChart3 className="size-3" />
            Sem benchmark
          </button>
        ) : latestBenchmark.regression ? (
          <Link
            to="/agents/$id/benchmarks/$runId"
            params={{ id, runId: latestBenchmark.id }}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:opacity-80 transition-opacity"
          >
            <TrendingDown className="size-3" />
            Regressao detectada
          </Link>
        ) : latestBenchmark.delta != null && latestBenchmark.delta > 0.005 ? (
          <Link
            to="/agents/$id/benchmarks/$runId"
            params={{ id, runId: latestBenchmark.id }}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:opacity-80 transition-opacity"
          >
            <TrendingUp className="size-3" />
            Score melhorou
          </Link>
        ) : (
          <button
            onClick={() => navigate({ to: "/agents/$id", params: { id }, search: { tab: "benchmarks" } })}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:opacity-80 transition-opacity"
          >
            <BarChart3 className="size-3" />
            Sem benchmark
          </button>
        )}
      </div>

      <Outlet />
    </div>
  );
}
