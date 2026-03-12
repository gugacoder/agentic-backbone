import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useMatch, useNavigate, Outlet } from "@tanstack/react-router";
import { Plug, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { AdapterCard } from "@/components/adapters/adapter-card";
import { AdapterDialog } from "@/components/adapters/adapter-dialog";
import { adaptersQueryOptions, type Adapter } from "@/api/adapters";

export const Route = createFileRoute("/_authenticated/adapters")({
  staticData: { title: "Adaptadores", description: "Gerencie conectores de integração" },
  component: AdaptersLayout,
});

const CONNECTOR_GROUPS = [
  {
    label: null,
    items: [{ value: "Todos", label: "Todos" }],
  },
  {
    label: "Banco de Dados",
    items: [
      { value: "mysql", label: "MySQL" },
      { value: "postgres", label: "Postgres" },
    ],
  },
  {
    label: "Comunicação",
    items: [
      { value: "evolution", label: "Evolution" },
      { value: "twilio", label: "Twilio" },
      { value: "whatsapp-cloud", label: "WhatsApp Cloud" },
      { value: "email", label: "Email (IMAP/SMTP)" },
      { value: "discord", label: "Discord" },
    ],
  },
  {
    label: "IA & Mídia",
    items: [{ value: "elevenlabs", label: "ElevenLabs (TTS)" }],
  },
  {
    label: "Automação",
    items: [
      { value: "http", label: "HTTP" },
      { value: "mcp", label: "MCP Server" },
    ],
  },
  {
    label: "DevOps",
    items: [
      { value: "gitlab", label: "GitLab" },
      { value: "github", label: "GitHub" },
    ],
  },
] as const;

type ConnectorFilter = (typeof CONNECTOR_GROUPS)[number]["items"][number]["value"];

const FILTER_LABELS = Object.fromEntries(
  CONNECTOR_GROUPS.flatMap((g) => g.items).map((i) => [i.value, i.label])
) as Record<ConnectorFilter, string>;

function AdaptersLayout() {
  const navigate = useNavigate();
  const { data: adapters, isLoading } = useQuery(adaptersQueryOptions());
  const [filter, setFilter] = useState<ConnectorFilter>("Todos");
  const [editingAdapter, setEditingAdapter] = useState<Adapter | null>(null);

  const isNewRoute = useMatch({ from: "/_authenticated/adapters/new", shouldThrow: false });
  const isSheetOpen = !!isNewRoute || editingAdapter !== null;
  const currentAdapter = isNewRoute ? ({} as Adapter) : editingAdapter;

  function handleSheetOpenChange(open: boolean) {
    if (!open) {
      setEditingAdapter(null);
      navigate({ to: "/adapters" });
    }
  }

  const filtered =
    filter === "Todos"
      ? (adapters ?? [])
      : (adapters ?? []).filter((a) => a.connector === filter);

  function countFor(f: ConnectorFilter) {
    if (!adapters) return 0;
    return f === "Todos" ? adapters.length : adapters.filter((a) => a.connector === f).length;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button size="sm" onClick={() => navigate({ to: "/adapters/new" })}>
            <Plus className="mr-1.5 h-4 w-4" />
            Novo Adaptador
          </Button>
        }
      />

      <div className="flex gap-6">
        {/* Vertical sidebar menu */}
        <nav className="w-48 shrink-0 flex flex-col gap-0.5">
          {CONNECTOR_GROUPS.map((group, gi) => (
            <div key={gi} className={cn("flex flex-col gap-0.5", gi > 0 && group.label && "mt-3")}>
              {group.label && (
                <span className="px-3 py-1 text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wide">
                  {group.label}
                </span>
              )}
              {group.items.map(({ value, label }) => {
                const count = countFor(value);
                return (
                  <button
                    key={value}
                    onClick={() => setFilter(value)}
                    className={cn(
                      "w-full flex items-center justify-between rounded-md px-3 py-1.5 text-sm text-left transition-colors",
                      filter === value
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <span>{label}</span>
                    {count > 0 && (
                      <span className={cn(
                        "text-xs tabular-nums",
                        filter === value ? "text-accent-foreground" : "text-muted-foreground"
                      )}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Plug />}
              title="Nenhum adaptador encontrado"
              description={
                filter === "Todos"
                  ? "Crie um adaptador para conectar agentes a servicos externos."
                  : `Nenhum adaptador do tipo ${FILTER_LABELS[filter]} configurado.`
              }
              action={
                filter === "Todos" ? (
                  <Button size="sm" onClick={() => navigate({ to: "/adapters/new" })}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Novo Adaptador
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((adapter) => (
                <AdapterCard
                  key={adapter.slug}
                  adapter={adapter}
                  onEdit={setEditingAdapter}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <AdapterDialog
        open={isSheetOpen}
        onOpenChange={handleSheetOpenChange}
        editingAdapter={currentAdapter}
        defaultConnector={filter !== "Todos" ? filter : undefined}
      />

      <Outlet />
    </div>
  );
}
