import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { menuConfigQueryOptions, updateMenuConfig, type MenuConfig } from "@/api/settings";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MAIN_ITEMS: { key: string; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "agentes", label: "Agentes" },
  { key: "workflows", label: "Workflows" },
  { key: "conversas", label: "Conversas" },
  { key: "canais", label: "Canais" },
  { key: "inbox", label: "Inbox" },
  { key: "agenda", label: "Agenda" },
  { key: "jobs", label: "Jobs" },
  { key: "aprovacoes", label: "Aprovações" },
  { key: "analytics", label: "Analytics" },
  { key: "ratings", label: "Ratings" },
  { key: "custos", label: "Custos" },
  { key: "notificacoes", label: "Notificações" },
  { key: "adaptadores", label: "Adaptadores" },
  { key: "seguranca", label: "Segurança" },
  { key: "conformidade", label: "Conformidade" },
  { key: "fleet", label: "Fleet" },
  { key: "opentelemetry", label: "OpenTelemetry" },
  { key: "configuracoes", label: "Configurações" },
];

const AGENT_ITEMS: { key: string; label: string }[] = [
  { key: "configuracao", label: "Configuração" },
  { key: "conversas", label: "Conversas" },
  { key: "memoria", label: "Memória" },
  { key: "knowledge", label: "Knowledge" },
  { key: "agenda", label: "Agenda" },
  { key: "avaliacao", label: "Avaliação" },
  { key: "qualidade", label: "Qualidade" },
  { key: "benchmarks", label: "Benchmarks" },
  { key: "webhooks", label: "Webhooks" },
  { key: "canais", label: "Canais" },
  { key: "mcp_tools", label: "MCP Tools" },
  { key: "handoffs", label: "Handoffs" },
  { key: "routing", label: "Routing" },
  { key: "workflows", label: "Workflows" },
  { key: "sandbox", label: "Sandbox" },
  { key: "versoes", label: "Versões" },
  { key: "quotas", label: "Quotas" },
  { key: "circuit_breaker", label: "Circuit Breaker" },
  { key: "conformidade", label: "Conformidade" },
];

export function MenuSettings() {
  const queryClient = useQueryClient();
  const { data: config, isLoading } = useQuery(menuConfigQueryOptions());
  const [local, setLocal] = useState<MenuConfig | null>(null);

  const displayed = local ?? config;

  const mutation = useMutation({
    mutationFn: updateMenuConfig,
    onSuccess: (updated) => {
      queryClient.setQueryData(["settings", "menu"], updated);
      setLocal(null);
      toast.success("Configuração de menu salva");
    },
    onError: () => toast.error("Erro ao salvar configuração de menu"),
  });

  if (isLoading) {
    return (
      <div className="flex flex-wrap gap-4 pt-2">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!displayed) return null;

  function toggle(ctx: "main" | "agent", key: string, checked: boolean) {
    const base = local ?? structuredClone(config!);
    setLocal({
      ...base,
      contexts: {
        ...base.contexts,
        [ctx]: { ...base.contexts[ctx], [key]: checked },
      },
    });
  }

  function handleSave() {
    if (displayed) mutation.mutate(displayed);
  }

  return (
    <div className="space-y-6 pt-2">
      <div className="flex flex-wrap gap-4 items-start">
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Menu Principal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {MAIN_ITEMS.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between gap-8">
                <Label className="text-sm">{label}</Label>
                <Switch
                  checked={displayed.contexts.main[key] ?? true}
                  onCheckedChange={(v) => toggle("main", key, v)}
                  disabled={mutation.isPending}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Menu do Agente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {AGENT_ITEMS.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between gap-8">
                <Label className="text-sm">{label}</Label>
                <Switch
                  checked={displayed.contexts.agent[key] ?? true}
                  onCheckedChange={(v) => toggle("agent", key, v)}
                  disabled={mutation.isPending}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Button onClick={handleSave} disabled={mutation.isPending || local === null}>
        Salvar
      </Button>
    </div>
  );
}
