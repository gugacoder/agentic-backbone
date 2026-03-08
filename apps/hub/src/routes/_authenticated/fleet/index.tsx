import { useState, useCallback, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  Activity,
  AlertTriangle,
  DollarSign,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  CheckSquare,
  Square,
  MoreHorizontal,
  Play,
  Pause,
  Zap,
  Skull,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  fleetQueryOptions,
  fleetSummaryQueryOptions,
  fleetBatch,
  type FleetAgent,
  type FleetStatus,
  type FleetQueryParams,
  type BatchAction,
} from "@/api/fleet";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSSEEvent, type SystemEvent } from "@/hooks/use-sse";

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/_authenticated/fleet/")({
  component: FleetPage,
});

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  FleetStatus,
  { label: string; className: string }
> = {
  active: { label: "Ativo", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  paused: { label: "Pausado", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  alert: { label: "Alerta", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  killed: { label: "Parado", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  error: { label: "Erro", className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
};

function StatusBadge({ status }: { status: FleetStatus }) {
  const { label, className } = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

// ─── Health Bar ───────────────────────────────────────────────────────────────

function HealthBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  const color =
    pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums text-xs">{pct}%</span>
    </div>
  );
}

// ─── Relative Time ────────────────────────────────────────────────────────────

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function formatCost(usd: number): string {
  if (usd === 0) return "—";
  return `$${usd.toFixed(4)}`;
}

function formatTokens(n: number): string {
  if (n === 0) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCards() {
  const { data: summary, isLoading } = useQuery(fleetSummaryQueryOptions());

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  const s = summary ?? {
    totalAgents: 0,
    activeAgents: 0,
    errorAgents: 0,
    totalCostToday: 0,
    killedAgents: 0,
    activeAlerts: 0,
  };

  const problemCount = s.errorAgents + s.killedAgents;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card>
        <CardHeader className="pb-1 pt-4 px-4">
          <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Bot className="size-3.5" />
            Total
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <p className="text-2xl font-bold">{s.totalAgents}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1 pt-4 px-4">
          <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Activity className="size-3.5" />
            Ativos
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <p className="text-2xl font-bold text-green-600">{s.activeAgents}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1 pt-4 px-4">
          <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <AlertTriangle className="size-3.5" />
            Problemas
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <p className={`text-2xl font-bold ${problemCount > 0 ? "text-destructive" : "text-green-600"}`}>
            {problemCount}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1 pt-4 px-4">
          <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <DollarSign className="size-3.5" />
            Custo Hoje
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <p className="text-2xl font-bold">{formatCost(s.totalCostToday)}</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sort Button ──────────────────────────────────────────────────────────────

type SortBy = FleetQueryParams["sortBy"];
type SortDir = "asc" | "desc";

function SortButton({
  field,
  label,
  sortBy,
  sortDir,
  onSort,
}: {
  field: SortBy;
  label: string;
  sortBy: SortBy;
  sortDir: SortDir;
  onSort: (field: SortBy) => void;
}) {
  const active = sortBy === field;
  return (
    <button
      onClick={() => onSort(field)}
      className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted"
      }`}
    >
      {label}
      {active ? (
        sortDir === "asc" ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />
      ) : (
        <ChevronsUpDown className="size-3 opacity-50" />
      )}
    </button>
  );
}

// ─── Agent Dropdown Actions ───────────────────────────────────────────────────

function AgentActions({
  agent,
  onAction,
}: {
  agent: FleetAgent;
  onAction: (agentId: string, action: BatchAction) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link to="/agents/$id" params={{ id: agent.id }}>
            <ExternalLink className="mr-2 size-3.5" />
            Ver agente
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {agent.enabled ? (
          <DropdownMenuItem onClick={() => onAction(agent.id, "disable")}>
            <Pause className="mr-2 size-3.5" />
            Desativar
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => onAction(agent.id, "enable")}>
            <Play className="mr-2 size-3.5" />
            Ativar
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => onAction(agent.id, "trigger_heartbeat")}>
          <RefreshCw className="mr-2 size-3.5" />
          Trigger Heartbeat
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {agent.circuitBreaker.killSwitch ? (
          <DropdownMenuItem onClick={() => onAction(agent.id, "deactivate_kill_switch")}>
            <Zap className="mr-2 size-3.5" />
            Reativar (remover kill)
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() => onAction(agent.id, "activate_kill_switch")}
            className="text-destructive focus:text-destructive"
          >
            <Skull className="mr-2 size-3.5" />
            Kill Switch
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Desktop Table ────────────────────────────────────────────────────────────

function AgentTable({
  agents,
  selected,
  onToggle,
  onToggleAll,
  onAction,
  sortBy,
  sortDir,
  onSort,
}: {
  agents: FleetAgent[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onAction: (agentId: string, action: BatchAction) => void;
  sortBy: SortBy;
  sortDir: SortDir;
  onSort: (field: SortBy) => void;
}) {
  const allSelected = agents.length > 0 && agents.every((a) => selected.has(a.id));
  const someSelected = !allSelected && agents.some((a) => selected.has(a.id));

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="w-10 px-3">
              <button onClick={onToggleAll} className="flex items-center">
                {allSelected ? (
                  <CheckSquare className="size-4 text-primary" />
                ) : someSelected ? (
                  <CheckSquare className="size-4 text-muted-foreground" />
                ) : (
                  <Square className="size-4 text-muted-foreground" />
                )}
              </button>
            </TableHead>
            <TableHead>
              <SortButton field="name" label="Nome" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            </TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>
              <SortButton field="errors" label="Saúde" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            </TableHead>
            <TableHead>
              <SortButton field="tokens" label="Tokens" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            </TableHead>
            <TableHead>Custo</TableHead>
            <TableHead>
              <SortButton field="lastActivity" label="Último HB" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            </TableHead>
            <TableHead>Alertas</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                Nenhum agente encontrado.
              </TableCell>
            </TableRow>
          ) : (
            agents.map((agent) => (
              <TableRow
                key={agent.id}
                className={selected.has(agent.id) ? "bg-primary/5" : undefined}
              >
                <TableCell className="px-3">
                  <Checkbox
                    checked={selected.has(agent.id)}
                    onCheckedChange={() => onToggle(agent.id)}
                  />
                </TableCell>
                <TableCell className="font-mono text-xs font-medium">
                  <Link
                    to="/agents/$id"
                    params={{ id: agent.id }}
                    className="hover:text-primary hover:underline"
                  >
                    {agent.label}
                  </Link>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{agent.owner}</TableCell>
                <TableCell>
                  <StatusBadge status={agent.status} />
                </TableCell>
                <TableCell>
                  <HealthBar rate={agent.health.heartbeatSuccessRate24h} />
                </TableCell>
                <TableCell className="text-xs tabular-nums">
                  {formatTokens(agent.consumption.tokensToday)}
                </TableCell>
                <TableCell className="text-xs tabular-nums text-muted-foreground">
                  {formatCost(agent.consumption.costToday)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {relativeTime(agent.health.lastHeartbeat)}
                </TableCell>
                <TableCell>
                  {agent.alerts.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {agent.alerts.slice(0, 2).map((a) => (
                        <span
                          key={a}
                          className="inline-flex items-center rounded-sm bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive"
                        >
                          {a.replace(/_/g, " ")}
                        </span>
                      ))}
                      {agent.alerts.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{agent.alerts.length - 2}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="px-2">
                  <AgentActions agent={agent} onAction={onAction} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Mobile Cards ─────────────────────────────────────────────────────────────

function AgentCard({
  agent,
  selected,
  onToggle,
  onAction,
}: {
  agent: FleetAgent;
  selected: boolean;
  onToggle: () => void;
  onAction: (agentId: string, action: BatchAction) => void;
}) {
  return (
    <div className={`rounded-lg border p-3 ${selected ? "border-primary bg-primary/5" : "bg-card"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Checkbox checked={selected} onCheckedChange={onToggle} />
          <div className="min-w-0">
            <Link
              to="/agents/$id"
              params={{ id: agent.id }}
              className="block truncate font-mono text-xs font-medium hover:text-primary hover:underline"
            >
              {agent.label}
            </Link>
            <span className="text-xs text-muted-foreground">{agent.owner}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusBadge status={agent.status} />
          <AgentActions agent={agent} onAction={onAction} />
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Saúde</p>
          <HealthBar rate={agent.health.heartbeatSuccessRate24h} />
        </div>
        <div>
          <p className="text-muted-foreground">Tokens</p>
          <p className="font-medium tabular-nums">{formatTokens(agent.consumption.tokensToday)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Último HB</p>
          <p className="font-medium">{relativeTime(agent.health.lastHeartbeat)}</p>
        </div>
      </div>
      {agent.alerts.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {agent.alerts.map((a) => (
            <span
              key={a}
              className="inline-flex items-center rounded-sm bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive"
            >
              {a.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Batch Action Bar ─────────────────────────────────────────────────────────

function BatchActionBar({
  selected,
  onAction,
  onClear,
  isPending,
}: {
  selected: Set<string>;
  onAction: (action: BatchAction) => void;
  onClear: () => void;
  isPending: boolean;
}) {
  if (selected.size === 0) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
      <span className="text-xs font-medium">
        {selected.size} selecionado{selected.size !== 1 ? "s" : ""}
      </span>
      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={isPending}
          onClick={() => onAction("enable")}
        >
          <Play className="mr-1 size-3" />
          Ativar
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={isPending}
          onClick={() => onAction("disable")}
        >
          <Pause className="mr-1 size-3" />
          Desativar
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={isPending}
          onClick={() => onAction("trigger_heartbeat")}
        >
          <RefreshCw className="mr-1 size-3" />
          Trigger HB
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs text-destructive hover:text-destructive"
          disabled={isPending}
          onClick={() => onAction("activate_kill_switch")}
        >
          <Skull className="mr-1 size-3" />
          Kill Switch
        </Button>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-xs"
        onClick={onClear}
      >
        Limpar
      </Button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function FleetPage() {
  const queryClient = useQueryClient();

  // Filters state
  const [ownerFilter, setOwnerFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<FleetStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<NonNullable<FleetQueryParams["sortBy"]>>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Build query params (server-side: owner, status, sort)
  const queryParams: FleetQueryParams = {
    owner: ownerFilter || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    sortBy,
    sortDir,
  };

  const { data, isLoading } = useQuery(fleetQueryOptions(queryParams));

  // Client-side name search filter
  const filteredAgents = useMemo(() => {
    if (!data?.agents) return [];
    if (!search.trim()) return data.agents;
    const q = search.toLowerCase();
    return data.agents.filter(
      (a) => a.label.toLowerCase().includes(q) || a.id.toLowerCase().includes(q)
    );
  }, [data?.agents, search]);

  // Extract unique owners for filter dropdown
  const owners = useMemo(() => {
    const set = new Set(data?.agents.map((a) => a.owner) ?? []);
    return Array.from(set).sort();
  }, [data?.agents]);

  // Sort handler
  function handleSort(field: typeof sortBy) {
    if (field === sortBy) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
    setSelected(new Set());
  }

  // Selection handlers
  function toggleAgent(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const allIds = filteredAgents.map((a) => a.id);
    const allSelected = allIds.every((id) => selected.has(id));
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  }

  // Batch mutation
  const batchMutation = useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: BatchAction }) =>
      fleetBatch(ids, action),
    onSuccess: (result, { action }) => {
      const ok = result.results.filter((r) => r.ok).length;
      const fail = result.results.length - ok;
      if (fail === 0) {
        toast.success(`Ação executada em ${ok} agente${ok !== 1 ? "s" : ""}`);
      } else {
        toast.warning(`${ok} ok, ${fail} falha${fail !== 1 ? "s" : ""}`);
      }
      queryClient.invalidateQueries({ queryKey: ["fleet"] });
      setSelected(new Set());
    },
    onError: () => {
      toast.error("Erro ao executar ação em lote");
    },
  });

  function handleSingleAction(agentId: string, action: BatchAction) {
    batchMutation.mutate({ ids: [agentId], action });
  }

  function handleBatchAction(action: BatchAction) {
    batchMutation.mutate({ ids: Array.from(selected), action });
  }

  // SSE: invalidate fleet queries on fleet:* and circuit_breaker:* events
  useSSEEvent(
    "fleet:agent_status",
    useCallback(
      (_event: SystemEvent) => {
        queryClient.invalidateQueries({ queryKey: ["fleet"] });
      },
      [queryClient]
    )
  );

  useSSEEvent(
    "fleet:alert",
    useCallback(
      (_event: SystemEvent) => {
        queryClient.invalidateQueries({ queryKey: ["fleet"] });
      },
      [queryClient]
    )
  );

  useSSEEvent(
    "circuit_breaker:tripped",
    useCallback(
      (_event: SystemEvent) => {
        queryClient.invalidateQueries({ queryKey: ["fleet"] });
      },
      [queryClient]
    )
  );

  useSSEEvent(
    "circuit_breaker:resumed",
    useCallback(
      (_event: SystemEvent) => {
        queryClient.invalidateQueries({ queryKey: ["fleet"] });
      },
      [queryClient]
    )
  );

  useSSEEvent(
    "circuit_breaker:kill_switch",
    useCallback(
      (_event: SystemEvent) => {
        queryClient.invalidateQueries({ queryKey: ["fleet"] });
      },
      [queryClient]
    )
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fleet"
        description="Visão geral e gerenciamento de todos os agentes"
      />

      {/* Summary Cards */}
      <SummaryCards />

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar agente..."
            className="h-8 pl-8 text-sm"
          />
        </div>

        <Select value={ownerFilter || "all"} onValueChange={(v) => setOwnerFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="h-8 w-40">
            <SelectValue placeholder="Owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os owners</SelectItem>
            {owners.map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FleetStatus | "all")}>
          <SelectTrigger className="h-8 w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="paused">Pausado</SelectItem>
            <SelectItem value="alert">Alerta</SelectItem>
            <SelectItem value="killed">Parado</SelectItem>
            <SelectItem value="error">Erro</SelectItem>
          </SelectContent>
        </Select>

        {data && (
          <span className="text-xs text-muted-foreground ml-auto">
            {filteredAgents.length} de {data.total} agente{data.total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Batch Action Bar */}
      <BatchActionBar
        selected={selected}
        onAction={handleBatchAction}
        onClear={() => setSelected(new Set())}
        isPending={batchMutation.isPending}
      />

      {/* Desktop Table */}
      {isLoading ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : (
        <>
          <div className="hidden md:block">
            <AgentTable
              agents={filteredAgents}
              selected={selected}
              onToggle={toggleAgent}
              onToggleAll={toggleAll}
              onAction={handleSingleAction}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={handleSort}
            />
          </div>

          {/* Mobile Cards */}
          <div className="grid gap-2 md:hidden">
            {filteredAgents.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum agente encontrado.
              </p>
            ) : (
              filteredAgents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  selected={selected.has(agent.id)}
                  onToggle={() => toggleAgent(agent.id)}
                  onAction={handleSingleAction}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
