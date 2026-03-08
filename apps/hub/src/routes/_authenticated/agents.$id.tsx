import { useCallback, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  Settings,
  MessageSquare,
  Brain,
  Clock,
  BookOpen,
  ChevronRight,
  FlaskConical,
  Star,
  Webhook,
  GitMerge,
  Gauge,
  History,
  Layers,
  Plug,
  GitBranch,
  Mail,
  BarChart3,
  TrendingDown,
  TrendingUp,
  Network,
} from "lucide-react";
import {
  agentQueryOptions,
  agentStatsQueryOptions,
  agentHeartbeatHistoryQueryOptions,
} from "@/api/agents";
import type { HeartbeatLogEntry } from "@/api/agents";
import { agentRatingsSummaryQueryOptions } from "@/api/ratings";
import { benchmarkLatestQueryOptions } from "@/api/benchmarks";
import { cn } from "@/lib/utils";
import { AgentMetrics } from "@/components/agents/agent-metrics";
import { HeartbeatTimeline } from "@/components/agents/heartbeat-timeline";
import { AgentActions } from "@/components/agents/agent-actions";
import { AgentConfigTabs } from "@/components/agents/agent-config-tabs";
import { AgentConversations } from "@/components/agents/agent-conversations";
import { MemoryStatusPanel } from "@/components/agents/memory-status-panel";
import { AgentCronTab } from "@/components/agents/agent-cron-tab";
import { KnowledgeTab } from "@/components/agents/knowledge-tab";
import { EvalTab } from "@/components/agents/eval-tab";
import { QualityTab } from "@/components/quality/quality-tab";
import { WebhooksTab } from "@/components/webhooks/webhooks-tab";
import { HandoffsTab } from "@/components/handoffs/handoffs-tab";
import { QuotasTab } from "@/components/quotas/quotas-tab";
import { VersionsTab } from "@/components/versions/versions-tab";
import { SandboxTab } from "@/components/sandbox/sandbox-tab";
import { McpToolsTab } from "@/components/mcp/mcp-tools-tab";
import { RoutingAnalyticsTab } from "@/components/routing/routing-analytics-tab";
import { EmailChannelsTab } from "@/components/email/email-channels-tab";
import { BenchmarkTab } from "@/components/agents/benchmark-tab";
import { WorkflowsTab } from "@/components/agents/workflows-tab";
import { StatusBadge } from "@/components/shared/status-badge";
import { useSSEEvent } from "@/hooks/use-sse";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

const tabs = [
  { value: "overview", label: "Visao Geral", icon: Eye },
  { value: "config", label: "Configuracao", icon: Settings },
  { value: "conversations", label: "Conversas", icon: MessageSquare },
  { value: "memory", label: "Memoria", icon: Brain },
  { value: "knowledge", label: "Knowledge", icon: BookOpen },
  { value: "cron", label: "Agenda", icon: Clock },
  { value: "evaluation", label: "Avaliacao", icon: FlaskConical },
  { value: "quality", label: "Qualidade", icon: Star },
  { value: "webhooks", label: "Webhooks", icon: Webhook },
  { value: "handoffs", label: "Handoffs", icon: GitMerge },
  { value: "quotas", label: "Quotas", icon: Gauge },
  { value: "versions", label: "Versoes", icon: History },
  { value: "sandbox", label: "Sandbox", icon: Layers },
  { value: "mcp-tools", label: "MCP Tools", icon: Plug },
  { value: "routing", label: "Routing", icon: GitBranch },
  { value: "channels", label: "Canais", icon: Mail },
  { value: "benchmarks", label: "Benchmarks", icon: BarChart3 },
  { value: "workflows", label: "Workflows", icon: Network },
] as const;

type TabValue = (typeof tabs)[number]["value"];

interface AgentSearchParams {
  tab?: TabValue;
  subtab?: string;
  days?: number;
}

export const Route = createFileRoute("/_authenticated/agents/$id")({
  validateSearch: (search: Record<string, unknown>): AgentSearchParams => ({
    tab: tabs.some((t) => t.value === search.tab)
      ? (search.tab as TabValue)
      : undefined,
    subtab: typeof search.subtab === "string" ? search.subtab : undefined,
    days:
      typeof search.days === "number" && [7, 30, 90].includes(search.days as number)
        ? (search.days as number)
        : undefined,
  }),
  component: AgentDetailPage,
});

function AgentDetailPage() {
  const { id } = Route.useParams();
  const { tab, subtab, days } = Route.useSearch();
  const navigate = useNavigate();

  const activeTab = tab ?? "overview";

  const queryClient = useQueryClient();
  const { data: agent, isLoading } = useQuery(agentQueryOptions(id));
  const { data: stats } = useQuery(agentStatsQueryOptions(id));
  const { data: history, isLoading: historyLoading } = useQuery(
    agentHeartbeatHistoryQueryOptions(id),
  );
  const { data: ratingsSummary } = useQuery(agentRatingsSummaryQueryOptions(id));
  const { data: latestBenchmark } = useQuery(benchmarkLatestQueryOptions(id));

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

  const timelineEntries = [
    ...sseEntries,
    ...(history ?? []),
  ].slice(0, 20);

  function handleTabChange(value: TabValue) {
    navigate({
      to: "/agents/$id",
      params: { id },
      search: { tab: value },
      replace: true,
    });
  }

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

  const isActive = agent.enabled && agent.heartbeatEnabled;

  return (
    <div className="space-y-6">
      {/* Header with breadcrumb + status */}
      <div className="space-y-1">
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/agents" className="hover:text-foreground transition-colors">
            Agentes
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="text-foreground font-medium">{agent.slug}</span>
        </nav>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold tracking-tight">
            {agent.slug}
          </h1>
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
          {/* Benchmark health badge */}
          {latestBenchmark == null ? (
            <button
              onClick={() => handleTabChange("benchmarks")}
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
              onClick={() => handleTabChange("benchmarks")}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:opacity-80 transition-opacity"
            >
              <BarChart3 className="size-3" />
              Sem benchmark
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => handleTabChange(v as TabValue)}
      >
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              <t.icon className="size-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <div className="space-y-6">
            <AgentActions agent={agent} />
            {stats && <AgentMetrics stats={stats} />}
            <div>
              <h3 className="mb-3 text-sm font-medium">Heartbeats recentes</h3>
              <HeartbeatTimeline
                entries={timelineEntries}
                loading={historyLoading}
              />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="config">
          <AgentConfigTabs agentId={id} agent={agent} subtab={subtab} />
        </TabsContent>
        <TabsContent value="conversations">
          <AgentConversations agentId={id} agentSlug={agent.slug} />
        </TabsContent>
        <TabsContent value="memory">
          <MemoryStatusPanel agentId={id} />
        </TabsContent>
        <TabsContent value="knowledge">
          <KnowledgeTab agentId={id} />
        </TabsContent>
        <TabsContent value="cron">
          <AgentCronTab agentId={id} />
        </TabsContent>
        <TabsContent value="evaluation">
          <EvalTab agentId={id} />
        </TabsContent>
        <TabsContent value="quality">
          <QualityTab agentId={id} days={days ?? 30} />
        </TabsContent>
        <TabsContent value="webhooks">
          <WebhooksTab agentId={id} />
        </TabsContent>
        <TabsContent value="handoffs">
          <HandoffsTab agentId={id} />
        </TabsContent>
        <TabsContent value="quotas">
          <QuotasTab agentId={id} />
        </TabsContent>
        <TabsContent value="versions">
          <VersionsTab agentId={id} />
        </TabsContent>
        <TabsContent value="sandbox">
          <SandboxTab agentId={id} />
        </TabsContent>
        <TabsContent value="mcp-tools">
          <McpToolsTab agentId={id} />
        </TabsContent>
        <TabsContent value="routing">
          <RoutingAnalyticsTab agentId={id} />
        </TabsContent>
        <TabsContent value="channels">
          <EmailChannelsTab agentId={id} />
        </TabsContent>
        <TabsContent value="benchmarks">
          <BenchmarkTab agentId={id} />
        </TabsContent>
        <TabsContent value="workflows">
          <WorkflowsTab agentId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
