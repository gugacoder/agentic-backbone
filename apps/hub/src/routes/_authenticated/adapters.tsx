import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useMatch, useNavigate, Outlet } from "@tanstack/react-router";
import { Plug, Plus } from "lucide-react";
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

const CONNECTOR_FILTERS = ["Todos", "mysql", "postgres", "evolution", "twilio", "http", "mcp"] as const;
type ConnectorFilter = (typeof CONNECTOR_FILTERS)[number];

const FILTER_LABELS: Record<ConnectorFilter, string> = {
  Todos: "Todos",
  mysql: "MySQL",
  postgres: "Postgres",
  evolution: "Evolution",
  twilio: "Twilio",
  http: "HTTP",
  mcp: "MCP",
};

function AdaptersLayout() {
  const navigate = useNavigate();
  const { data: adapters, isLoading } = useQuery(adaptersQueryOptions());
  const [filter, setFilter] = useState<ConnectorFilter>("Todos");
  const [editingAdapter, setEditingAdapter] = useState<Adapter | null>(null);

  // Check if we're on the /adapters/new route
  const isNewRoute = useMatch({ from: "/_authenticated/adapters/new", shouldThrow: false });

  // Sheet is open if we're on /adapters/new OR if editing an adapter card
  const isSheetOpen = !!isNewRoute || editingAdapter !== null;
  const currentAdapter = isNewRoute ? ({} as Adapter) : editingAdapter;

  function handleSheetOpenChange(open: boolean) {
    if (!open) {
      setEditingAdapter(null);
      // Navigate back to /adapters
      navigate({ to: "/adapters" });
    }
  }

  const filtered =
    filter === "Todos"
      ? (adapters ?? [])
      : (adapters ?? []).filter((a) => a.connector === filter);

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

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {CONNECTOR_FILTERS.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
            className="h-7 text-xs"
          >
            {FILTER_LABELS[f]}
          </Button>
        ))}
      </div>

      {/* Content */}
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

      <AdapterDialog
        open={isSheetOpen}
        onOpenChange={handleSheetOpenChange}
        editingAdapter={currentAdapter}
      />

      {/* Outlet for child routes */}
      <Outlet />
    </div>
  );
}
