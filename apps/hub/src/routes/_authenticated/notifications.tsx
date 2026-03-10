import { useState, useMemo, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Bell,
  AlertCircle,
  AlertTriangle,
  Info,
  Check,
  CheckCheck,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  notificationsQueryOptions,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  type Notification,
} from "@/api/notifications";
import { agentsQueryOptions } from "@/api/agents";
import { useSSEEvent, type SystemEvent } from "@/hooks/use-sse";

const PAGE_SIZE = 50;

type TypeFilter = "all" | "heartbeat" | "cron" | "job" | "system";
type ReadFilter = "all" | "unread";

export const Route = createFileRoute("/_authenticated/notifications")({
  staticData: { title: "Notificações", description: "Central de notificações do sistema" },
  component: NotificationsPage,
});

const typeFilterMap: Record<TypeFilter, string | undefined> = {
  all: undefined,
  heartbeat: "heartbeat_error",
  cron: "cron",
  job: "job",
  system: "system",
};

const typeButtons: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "heartbeat", label: "Heartbeat" },
  { value: "cron", label: "Cron" },
  { value: "job", label: "Jobs" },
];

const severityConfig: Record<string, { icon: typeof AlertCircle; className: string; label: string }> = {
  error: { icon: AlertCircle, className: "text-destructive", label: "Erro" },
  warning: { icon: AlertTriangle, className: "text-yellow-500", label: "Aviso" },
  info: { icon: Info, className: "text-blue-500", label: "Info" },
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function NotificationsPage() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const typeParam = typeFilter === "all" ? undefined : typeFilter === "heartbeat" ? "heartbeat_error" : undefined;
  const typePrefix = typeFilter !== "all" && typeFilter !== "heartbeat" ? typeFilter : undefined;

  const queryParams = useMemo(
    () => ({
      unread: readFilter === "unread" ? true : undefined,
      type: typeParam,
      agent_id: agentFilter !== "all" ? agentFilter : undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [readFilter, typeParam, agentFilter, page],
  );

  const { data, isLoading } = useQuery(notificationsQueryOptions(queryParams));
  const { data: agents } = useQuery(agentsQueryOptions());

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Client-side prefix filter for cron/job types (backend only supports exact type match)
  const filtered = useMemo(() => {
    if (!typePrefix) return rows;
    return rows.filter((n) => n.type.startsWith(typePrefix));
  }, [rows, typePrefix]);

  const uniqueAgentIds = useMemo(() => {
    const ids = new Set(rows.filter((n) => n.agentId).map((n) => n.agentId!));
    return Array.from(ids).sort();
  }, [rows]);

  const agentNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    (agents ?? []).forEach((a) => {
      map[a.id] = a.slug;
    });
    return map;
  }, [agents]);

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Notificacao excluida");
    },
  });

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Todas marcadas como lidas");
    },
  });

  useSSEEvent(
    "notification:new",
    useCallback(
      (_event: SystemEvent) => {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      },
      [queryClient],
    ),
  );

  function toggleExpanded(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
          >
            <CheckCheck className="mr-1.5 h-4 w-4" />
            Marcar todas como lidas
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <Select value={readFilter} onValueChange={(v) => { setReadFilter(v as ReadFilter); setPage(0); }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="unread">Nao lidas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={agentFilter} onValueChange={(v) => { setAgentFilter(v ?? "all"); setPage(0); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Agente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os agentes</SelectItem>
              {uniqueAgentIds.map((id) => (
                <SelectItem key={id} value={id}>
                  {agentNameMap[id] ?? id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-1 rounded-lg border p-0.5">
          {typeButtons.map((tb) => (
            <button
              key={tb.value}
              onClick={() => { setTypeFilter(tb.value); setPage(0); }}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                typeFilter === tb.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Bell />}
          title={total > 0 ? "Nenhuma notificacao encontrada" : "Nenhuma notificacao"}
          description={
            total > 0
              ? "Tente ajustar os filtros."
              : "Notificacoes do sistema aparecerao aqui."
          }
        />
      ) : (
        <>
          <div className="divide-y rounded-lg border">
            {filtered.map((n) => {
              const sev = severityConfig[n.severity] ?? severityConfig.info!;
              const Icon = sev.icon;
              const isExpanded = expandedIds.has(n.id);
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                    !n.read ? "bg-muted/30" : ""
                  }`}
                >
                  <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${sev.className}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${!n.read ? "" : "text-muted-foreground"}`}>
                        {n.title}
                      </span>
                      {!n.read && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                      )}
                    </div>
                    {n.body && (
                      <p
                        className={`mt-0.5 text-sm text-muted-foreground ${
                          !isExpanded ? "line-clamp-1 cursor-pointer" : "cursor-pointer"
                        }`}
                        onClick={() => toggleExpanded(n.id)}
                      >
                        {n.body}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      {n.agentId && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {agentNameMap[n.agentId] ?? n.agentId}
                        </Badge>
                      )}
                      <span>{timeAgo(n.ts)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!n.read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Marcar como lida"
                        onClick={() => markReadMutation.mutate(n.id)}
                        disabled={markReadMutation.isPending}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      title="Excluir"
                      onClick={() => deleteMutation.mutate(n.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 text-sm text-muted-foreground">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
