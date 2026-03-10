import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth";
import { Cpu, Search, Users, Server, Plug, GitBranch } from "lucide-react";
import { toast } from "sonner";
import { LlmPlanCard } from "@/components/settings/llm-plan-card";
import { WebSearchSettings } from "@/components/settings/web-search-settings";
import { SystemInfo } from "@/components/settings/system-info";
import { McpServerSettings } from "@/components/settings/mcp-server-settings";
import { RoutingSettings } from "@/components/routing/routing-settings";
import { UsersList } from "@/components/users/users-list";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { llmSettingsQueryOptions, activateLlmPlan } from "@/api/settings";

const settingsTabs = [
  { value: "llm", label: "LLM", icon: Cpu },
  { value: "web-search", label: "Web Search", icon: Search },
  { value: "routing", label: "Model Routing", icon: GitBranch },
  { value: "users", label: "Usuarios", icon: Users },
  { value: "system", label: "Sistema", icon: Server },
  { value: "mcp-server", label: "MCP Server", icon: Plug },
] as const;

type SettingsTab = (typeof settingsTabs)[number]["value"];

interface SettingsSearchParams {
  tab?: SettingsTab;
}

export const Route = createFileRoute("/_authenticated/settings")({
  staticData: { title: "Configurações", description: "Configurações do sistema" },
  validateSearch: (search: Record<string, unknown>): SettingsSearchParams => ({
    tab: settingsTabs.some((t) => t.value === search.tab)
      ? (search.tab as SettingsTab)
      : undefined,
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const activeTab = tab ?? "llm";

  if (user?.role !== "sysuser") {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-destructive">
          Acesso restrito. Apenas o administrador do sistema pode acessar as configuracoes.
        </div>
      </div>
    );
  }

  function handleTabChange(value: string) {
    navigate({
      to: "/settings",
      search: { tab: value as SettingsTab },
      replace: true,
    });
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          {settingsTabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              <t.icon className="size-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="llm">
          <LlmSettingsTab />
        </TabsContent>

        <TabsContent value="web-search">
          <WebSearchSettings />
        </TabsContent>

        <TabsContent value="users">
          <UsersList />
        </TabsContent>

        <TabsContent value="system">
          <SystemInfo />
        </TabsContent>

        <TabsContent value="routing">
          <RoutingSettings />
        </TabsContent>

        <TabsContent value="mcp-server">
          <McpServerSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LlmSettingsTab() {
  const queryClient = useQueryClient();
  const { data: config, isLoading } = useQuery(llmSettingsQueryOptions());
  const [activatingSlug, setActivatingSlug] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: activateLlmPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "llm"] });
      toast.success("Plano LLM atualizado com sucesso");
      setActivatingSlug(null);
    },
    onError: () => {
      toast.error("Erro ao atualizar plano LLM");
      setActivatingSlug(null);
    },
  });

  function handleActivate(slug: string) {
    setActivatingSlug(slug);
    mutation.mutate(slug);
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {config.plans.map((plan) => (
        <LlmPlanCard
          key={plan.name}
          plan={plan}
          isActive={config.activePlan === plan.name}
          onActivate={handleActivate}
          isLoading={activatingSlug === plan.name}
        />
      ))}
    </div>
  );
}
