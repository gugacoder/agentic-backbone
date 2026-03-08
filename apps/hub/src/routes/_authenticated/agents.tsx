import { useState, useMemo, useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { AgentCard, type HeartbeatLive } from "@/components/agents/agent-card";
import {
  agentsQueryOptions,
  agentStatsQueryOptions,
  toggleAgentEnabled,
} from "@/api/agents";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSSEEvent } from "@/hooks/use-sse";
import { useAuthStore } from "@/lib/auth";

type FilterValue = "all" | "active" | "inactive";

export const Route = createFileRoute("/_authenticated/agents")({
  component: AgentsPage,
});

function AgentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [heartbeatMap, setHeartbeatMap] = useState<Record<string, HeartbeatLive>>({});

  const userRole = useAuthStore((s) => s.user?.role);
  const isSysadmin = userRole === "sysuser";

  const { data: agents, isLoading } = useQuery(agentsQueryOptions(isSysadmin ? "all" : undefined));

  const statsQueries = useQueries({
    queries: (agents ?? []).map((a) => agentStatsQueryOptions(a.id)),
  });

  const statsMap = useMemo(() => {
    const map: Record<string, (typeof statsQueries)[number]["data"]> = {};
    (agents ?? []).forEach((a, i) => {
      map[a.id] = statsQueries[i]?.data;
    });
    return map;
  }, [agents, statsQueries]);

  useSSEEvent("heartbeat:status", useCallback((event) => {
    const agentId = event.data?.agentId as string | undefined;
    if (!agentId) return;
    setHeartbeatMap((prev) => ({
      ...prev,
      [agentId]: {
        status: (event.data?.status as string) ?? "ok",
        preview: event.data?.preview as string | undefined,
      },
    }));
  }, []));

  const toggleMutation = useMutation({
    mutationFn: (id: string) => toggleAgentEnabled(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  const handleToggle = useCallback(
    (id: string, _enabled: boolean) => {
      toggleMutation.mutate(id);
    },
    [toggleMutation],
  );

  const filtered = useMemo(() => {
    if (!agents) return [];
    return agents.filter((a) => {
      const matchesSearch = a.slug.toLowerCase().includes(search.toLowerCase());
      const matchesFilter =
        filter === "all" ||
        (filter === "active" && a.enabled) ||
        (filter === "inactive" && !a.enabled);
      return matchesSearch && matchesFilter;
    });
  }, [agents, search, filter]);

  const filterButtons: { value: FilterValue; label: string }[] = [
    { value: "all", label: "Todos" },
    { value: "active", label: "Ativos" },
    { value: "inactive", label: "Inativos" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agentes"
        description="Gerencie seus agentes de IA"
        actions={
          <Button
            size="sm"
            onClick={() => navigate({ to: "/agents/new" as string })}
          >
            <Plus className="mr-1 size-4" />
            Novo Agente
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar agente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex gap-1 rounded-lg border p-0.5">
          {filterButtons.map((fb) => (
            <button
              key={fb.value}
              onClick={() => setFilter(fb.value)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filter === fb.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {fb.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Bot />}
          title={agents?.length ? "Nenhum agente encontrado" : "Nenhum agente configurado"}
          description={
            agents?.length
              ? "Tente ajustar sua busca ou filtro."
              : "Em breve voce podera visualizar e gerenciar seus agentes aqui."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              stats={statsMap[agent.id]}
              heartbeatLive={heartbeatMap[agent.id]}
              onToggle={handleToggle}
              onClick={() => navigate({ to: `/agents/${agent.id}` as string })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
