import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Cpu, Search, Users, Server, Settings } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LlmPlanCard } from "@/components/settings/llm-plan-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { llmSettingsQueryOptions, activateLlmPlan } from "@/api/settings";

const settingsTabs = [
  { value: "llm", label: "LLM", icon: Cpu },
  { value: "web-search", label: "Web Search", icon: Search },
  { value: "users", label: "Usuarios", icon: Users },
  { value: "system", label: "Sistema", icon: Server },
] as const;

type SettingsTab = (typeof settingsTabs)[number]["value"];

interface SettingsSearchParams {
  tab?: SettingsTab;
}

export const Route = createFileRoute("/_authenticated/settings")({
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
  const activeTab = tab ?? "llm";

  function handleTabChange(value: string) {
    navigate({
      to: "/settings",
      search: { tab: value as SettingsTab },
      replace: true,
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuracoes"
        description="Configuracoes do sistema"
      />

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
          <EmptyState
            icon={<Search />}
            title="Web Search"
            description="Configuracao de provedor de busca em breve."
          />
        </TabsContent>

        <TabsContent value="users">
          <EmptyState
            icon={<Users />}
            title="Usuarios"
            description="Gestao de usuarios em breve."
          />
        </TabsContent>

        <TabsContent value="system">
          <EmptyState
            icon={<Server />}
            title="Sistema"
            description="Informacoes do sistema em breve."
          />
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
      {Object.entries(config.plans).map(([slug, plan]) => (
        <LlmPlanCard
          key={slug}
          slug={slug}
          plan={plan}
          isActive={config.active === slug}
          onActivate={handleActivate}
          isLoading={activatingSlug === slug}
        />
      ))}
    </div>
  );
}
