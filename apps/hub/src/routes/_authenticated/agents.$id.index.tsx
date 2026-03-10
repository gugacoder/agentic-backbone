import { useCallback, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  agentQueryOptions,
  agentStatsQueryOptions,
  agentHeartbeatHistoryQueryOptions,
} from "@/api/agents";
import type { HeartbeatLogEntry } from "@/api/agents";
import { AgentMetrics } from "@/components/agents/agent-metrics";
import { HeartbeatTimeline } from "@/components/agents/heartbeat-timeline";
import { AgentActions } from "@/components/agents/agent-actions";
import { useSSEEvent } from "@/hooks/use-sse";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/agents/$id/")({
  staticData: { title: "Visão Geral", description: "Resumo de atividade do agente" },
  component: AgentOverviewPage,
});

function AgentOverviewPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: agent, isLoading } = useQuery(agentQueryOptions(id));
  const { data: stats } = useQuery(agentStatsQueryOptions(id));
  const { data: history, isLoading: historyLoading } = useQuery(
    agentHeartbeatHistoryQueryOptions(id),
  );

  const [sseEntries, setSseEntries] = useState<HeartbeatLogEntry[]>([]);

  useSSEEvent(
    "heartbeat:status",
    useCallback(
      (event) => {
        const data = event.data;
        if (!data || data.agentId !== id) return;
        const entry: HeartbeatLogEntry = {
          id: `sse-${Date.now()}`,
          status: (data.status as HeartbeatLogEntry["status"]) ?? "ok",
          durationMs: (data.durationMs as number) ?? 0,
          preview: data.preview as string | undefined,
          createdAt: new Date().toISOString(),
        };
        setSseEntries((prev) => [entry, ...prev]);
        queryClient.invalidateQueries({
          queryKey: ["agents", id, "heartbeat-history"],
        });
      },
      [id, queryClient],
    ),
  );

  const timelineEntries = [...sseEntries, ...(history ?? [])].slice(0, 20);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-8 w-96" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Agente nao encontrado.</p>
        <Link to="/agents" className="text-sm text-primary underline">
          Voltar para Agentes
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AgentActions agent={agent} />
      {stats && <AgentMetrics stats={stats} />}
      <div>
        <h3 className="mb-3 text-sm font-medium">Heartbeats recentes</h3>
        <HeartbeatTimeline entries={timelineEntries} loading={historyLoading} />
      </div>
    </div>
  );
}
