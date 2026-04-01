import { useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, Clock, MessageSquare, Activity } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inboxQueryOptions, inboxMetricsQueryOptions, type InboxSession } from "@/api/inbox";
import { agentsQueryOptions } from "@/api/agents";
import { useSSEEvent, type SystemEvent } from "@/hooks/use-sse";

interface InboxSearchParams {
  channel?: string;
  agent_id?: string;
  status?: string;
}

export const Route = createFileRoute("/_authenticated/inbox/")({
  staticData: { title: "Inbox", description: "Conversas ativas em todos os canais e agentes" },
  validateSearch: (search: Record<string, unknown>): InboxSearchParams => ({
    channel: typeof search.channel === "string" ? search.channel : undefined,
    agent_id: typeof search.agent_id === "string" ? search.agent_id : undefined,
    status: typeof search.status === "string" ? search.status : undefined,
  }),
  component: InboxPage,
});

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "agora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `ha ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `ha ${hours}h`;
  const days = Math.floor(hours / 24);
  return `ha ${days}d`;
}

function formatAvgResponseMs(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function ChannelBadge({ channel }: { channel: string }) {
  const lower = channel.toLowerCase();
  if (lower.includes("whatsapp") || lower.includes("wpp") || lower.includes("evolution")) {
    return (
      <Badge className="shrink-0 bg-green-600 text-white hover:bg-green-700 text-[10px] px-1.5 py-0">
        WPP
      </Badge>
    );
  }
  if (lower.includes("voice") || lower.includes("voz") || lower.includes("twilio")) {
    return (
      <Badge className="shrink-0 bg-purple-600 text-white hover:bg-purple-700 text-[10px] px-1.5 py-0">
        VOZ
      </Badge>
    );
  }
  return (
    <Badge className="shrink-0 bg-blue-600 text-white hover:bg-blue-700 text-[10px] px-1.5 py-0">
      WEB
    </Badge>
  );
}

function StatusBadgeInbox({ status }: { status: InboxSession["status"] }) {
  if (status === "waiting") {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
        </span>
        <span className="text-[10px] font-medium text-destructive">Aguardando</span>
      </span>
    );
  }
  if (status === "operator") {
    return (
      <Badge className="bg-orange-500 text-white hover:bg-orange-600 text-[10px] px-1.5 py-0">
        Operador
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
      Agente
    </Badge>
  );
}

function InboxConversationCard({
  session,
  onClick,
}: {
  session: InboxSession;
  onClick: () => void;
}) {
  const preview = session.lastMessage?.content?.slice(0, 80) ?? "";
  const timestamp = session.lastMessage?.timestamp ?? session.startedAt;

  return (
    <button
      type="button"
      className="flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors hover:bg-muted/50"
      onClick={onClick}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted mt-0.5">
        <MessageSquare className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <ChannelBadge channel={session.channelType} />
          <span className="text-xs font-medium truncate max-w-[120px]">{session.agentLabel}</span>
          <StatusBadgeInbox status={session.status} />
        </div>
        {preview && (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{preview}</p>
        )}
        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>{session.messageCount} msgs</span>
          <span>·</span>
          <span>{formatRelativeTime(timestamp)}</span>
        </div>
      </div>
    </button>
  );
}

function InboxMetricsCards() {
  const { data: metrics, isLoading } = useQuery(inboxMetricsQueryOptions());

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  const waitingCount = metrics?.byStatus?.waiting ?? 0;
  const topChannel = metrics?.byChannel?.sort((a, b) => b.count - a.count)[0];
  const avgResponseMs = topChannel?.avgResponseMs ?? null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Activity className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{metrics?.totalActive ?? 0}</p>
            <p className="text-xs text-muted-foreground">Conversas Ativas</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <MessageSquare className="size-5 text-destructive" />
          </div>
          <div>
            <p className="text-2xl font-bold">{waitingCount}</p>
            <p className="text-xs text-muted-foreground">Aguardando Resposta</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
            <Clock className="size-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-2xl font-bold">{formatAvgResponseMs(avgResponseMs)}</p>
            <p className="text-xs text-muted-foreground">Tempo Medio</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
            <Inbox className="size-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-2xl font-bold truncate max-w-[100px]">
              {topChannel?.channel ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground">Canal Mais Ativo</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InboxPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();
  const { channel, agent_id, status } = Route.useSearch();

  const { data: inboxData, isLoading } = useQuery(
    inboxQueryOptions({
      channel: channel || undefined,
      agent_id: agent_id || undefined,
      status: status || undefined,
      limit: 50,
    }),
  );

  const { data: agents } = useQuery(agentsQueryOptions());

  useSSEEvent(
    "channel:message",
    useCallback(
      (_event: SystemEvent) => {
        queryClient.invalidateQueries({ queryKey: ["inbox"] });
      },
      [queryClient],
    ),
  );

  const sessions = inboxData?.sessions ?? [];

  function setFilter(key: keyof InboxSearchParams, value: string | undefined) {
    void navigate({
      search: (prev: InboxSearchParams) => ({
        ...prev,
        [key]: value || undefined,
      }),
    });
  }

  return (
    <div className="space-y-6">
      <InboxMetricsCards />

      {/* Filters */}
      <div className="flex flex-wrap gap-2 sm:flex-row sm:items-center">
        <Select
          value={channel ?? "all"}
          onValueChange={(v: string | null) => setFilter("channel", !v || v === "all" ? undefined : v)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Canal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os canais</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="web">Web</SelectItem>
            <SelectItem value="voice">Voz</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={agent_id ?? "all"}
          onValueChange={(v: string | null) => setFilter("agent_id", !v || v === "all" ? undefined : v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Agente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os agentes</SelectItem>
            {(agents ?? []).map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.slug}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status ?? "all"}
          onValueChange={(v: string | null) => setFilter("status", !v || v === "all" ? undefined : v)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="waiting">Aguardando</SelectItem>
            <SelectItem value="operator">Operador</SelectItem>
            <SelectItem value="agent">Agente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Conversation list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={<Inbox />}
          title="Nenhuma conversa encontrada"
          description="Quando houver conversas ativas nos canais, elas aparecerao aqui."
        />
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <InboxConversationCard
              key={session.sessionId}
              session={session}
              onClick={() =>
                navigate({ to: `/conversations/${session.sessionId}` as string })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
