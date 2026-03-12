import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth";
import { Cpu, Search, Users, Server, Plug, GitBranch, Key, Globe, LayoutDashboard, Mic } from "lucide-react";
import { toast } from "sonner";
import { LlmPlanCard } from "@/components/settings/llm-plan-card";
import { WebSearchSettings } from "@/components/settings/web-search-settings";
import { SystemInfo } from "@/components/settings/system-info";
import { McpServerSettings } from "@/components/settings/mcp-server-settings";
import { RoutingSettings } from "@/components/routing/routing-settings";
import { ProvidersSettings } from "@/components/settings/providers-settings";
import { NgrokSettings } from "@/components/settings/ngrok-settings";
import { WhisperSettings } from "@/components/settings/whisper-settings";
import { MenuSettings } from "@/components/settings/menu-settings";
import { UsersList } from "@/components/users/users-list";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { llmSettingsQueryOptions, activateLlmPlan } from "@/api/settings";

const settingsGroups = [
  {
    label: "LLM",
    items: [
      { value: "llm", label: "Plano", icon: Cpu },
      { value: "routing", label: "Model Routing", icon: GitBranch },
    ],
  },
  {
    label: "Infraestrutura",
    items: [
      { value: "providers", label: "Provedores", icon: Key },
      { value: "web-search", label: "Web Search", icon: Search },
      { value: "mcp-server", label: "MCP Server", icon: Plug },
      { value: "whisper", label: "Whisper", icon: Mic },
      { value: "ngrok", label: "ngrok", icon: Globe },
    ],
  },
  {
    label: "Sistema",
    items: [
      { value: "users", label: "Usuarios", icon: Users },
      { value: "menu", label: "Menu", icon: LayoutDashboard },
      { value: "system", label: "Sobre", icon: Server },
    ],
  },
] as const;

const settingsTabs = settingsGroups.flatMap((g) => g.items);

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
    <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
      {/* Mobile: select */}
      <div className="md:hidden">
        <Select value={activeTab} onValueChange={handleTabChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {settingsTabs.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                <div className="flex items-center gap-2">
                  <t.icon className="size-4" />
                  {t.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: sidebar nav */}
      <nav className="hidden md:flex md:flex-col md:w-52 md:shrink-0 gap-0.5">
        {settingsGroups.map((group, gi) => (
          <div key={group.label} className={cn("flex flex-col gap-0.5", gi > 0 && "mt-3")}>
            <span className="px-3 py-1 text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wide">
              {group.label}
            </span>
            {group.items.map((t) => (
              <button
                key={t.value}
                onClick={() => handleTabChange(t.value)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-left transition-colors w-full",
                  activeTab === t.value
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <t.icon className="size-4 shrink-0" />
                {t.label}
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {activeTab === "llm" && <LlmSettingsTab />}
        {activeTab === "web-search" && <WebSearchSettings />}
        {activeTab === "routing" && <RoutingSettings />}
        {activeTab === "users" && <UsersList />}
        {activeTab === "system" && <SystemInfo />}
        {activeTab === "mcp-server" && <McpServerSettings />}
        {activeTab === "providers" && <ProvidersSettings />}
        {activeTab === "whisper" && <WhisperSettings />}
        {activeTab === "ngrok" && <NgrokSettings />}
        {activeTab === "menu" && <MenuSettings />}
      </div>
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
    <div className="grid gap-4 xl:grid-cols-2">
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
