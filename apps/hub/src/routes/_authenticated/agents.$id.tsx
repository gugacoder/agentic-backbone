import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Eye,
  Settings,
  MessageSquare,
  Brain,
  Clock,
  ChevronRight,
} from "lucide-react";
import { agentQueryOptions } from "@/api/agents";
import { StatusBadge } from "@/components/shared/status-badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

const tabs = [
  { value: "overview", label: "Visao Geral", icon: Eye },
  { value: "config", label: "Configuracao", icon: Settings },
  { value: "conversations", label: "Conversas", icon: MessageSquare },
  { value: "memory", label: "Memoria", icon: Brain },
  { value: "cron", label: "Agenda", icon: Clock },
] as const;

type TabValue = (typeof tabs)[number]["value"];

interface AgentSearchParams {
  tab?: TabValue;
}

export const Route = createFileRoute("/_authenticated/agents/$id")({
  validateSearch: (search: Record<string, unknown>): AgentSearchParams => ({
    tab: tabs.some((t) => t.value === search.tab)
      ? (search.tab as TabValue)
      : undefined,
  }),
  component: AgentDetailPage,
});

function AgentDetailPage() {
  const { id } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();

  const activeTab = tab ?? "overview";

  const { data: agent, isLoading } = useQuery(agentQueryOptions(id));

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
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {agent.slug}
          </h1>
          <StatusBadge status={isActive ? "active" : "inactive"} />
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
          <PlaceholderTab label="Visao Geral" />
        </TabsContent>
        <TabsContent value="config">
          <PlaceholderTab label="Configuracao" />
        </TabsContent>
        <TabsContent value="conversations">
          <PlaceholderTab label="Conversas" />
        </TabsContent>
        <TabsContent value="memory">
          <PlaceholderTab label="Memoria" />
        </TabsContent>
        <TabsContent value="cron">
          <PlaceholderTab label="Agenda" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed">
      <p className="text-sm text-muted-foreground">
        {label} — Em breve
      </p>
    </div>
  );
}
