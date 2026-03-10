import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { channelsQuery, useDeleteChannel } from "@/api/channels";
import { useSSE } from "@/hooks/use-sse";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn } from "@/lib/utils";
import { Radio, Trash2, Users, ArrowLeft, Circle } from "lucide-react";
import { useState } from "react";

interface ChannelEvent {
  ts: number;
  type: string;
  data: unknown;
}

const MAX_EVENTS = 200;

export function ChannelsPage() {
  const isMobile = useIsMobile();
  const params = useParams({ strict: false }) as { slug?: string };
  const slug = params.slug;
  const navigate = useNavigate();

  const { data: channels, isLoading } = useQuery(channelsQuery);
  const deleteChannel = useDeleteChannel();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [events, setEvents] = useState<ChannelEvent[]>([]);

  const { connected } = useSSE({
    url: `/channels/${slug}/events`,
    enabled: !!slug,
    onEvent: (type, data) => {
      setEvents((prev) =>
        [{ ts: Date.now(), type, data }, ...prev].slice(0, MAX_EVENTS),
      );
    },
  });

  function handleSelectChannel(channelSlug: string) {
    setEvents([]);
    navigate({ to: "/channels/$slug", params: { slug: channelSlug } });
  }

  function handleBack() {
    setEvents([]);
    navigate({ to: "/channels" });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  // --- Mobile: progressive navigation ---
  if (isMobile) {
    // Monitor view
    if (slug) {
      return (
        <div className="-m-4 flex flex-col h-[calc(100vh-3rem-3.5rem)]">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleBack}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium truncate">{slug}</span>
            <ConnectionBadge connected={connected} />
          </div>
          <EventStream events={events} />
        </div>
      );
    }

    // Channel list
    return (
      <div className="space-y-4">
        <h2 className="font-semibold">Channels</h2>
        {!channels?.length ? (
          <EmptyState
            icon={Radio}
            title="Nenhum canal"
            description="Nenhum canal configurado."
          />
        ) : (
          <div className="space-y-2">
            {channels.map((ch) => (
              <div
                key={ch.slug}
                className="group flex items-center gap-3 rounded-md border px-3 py-3 cursor-pointer hover:bg-muted/50"
                onClick={() => handleSelectChannel(ch.slug)}
              >
                <Radio className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{ch.slug}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {ch.description || "Sem descricao"}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {ch.listeners ?? 0}
                  </div>
                  <StatusBadge status={ch.type} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- Desktop: two-panel layout ---
  return (
    <div className="-m-4 md:-m-6 flex h-[calc(100vh-3rem)] overflow-hidden border-t">
      {/* Sidebar */}
      <div className="w-64 shrink-0 border-r flex flex-col overflow-hidden">
        <div className="p-3 border-b">
          <h2 className="text-sm font-semibold">Channels</h2>
          <p className="text-xs text-muted-foreground">
            {channels?.length ?? 0} canal(is)
          </p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {channels?.map((ch) => (
              <div
                key={ch.slug}
                className={cn(
                  "group flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer hover:bg-muted/50",
                  slug === ch.slug && "bg-muted",
                )}
                onClick={() => handleSelectChannel(ch.slug)}
              >
                <Radio className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{ch.slug}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {ch.listeners ?? 0}
                    </span>
                    <StatusBadge status={ch.type} />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(ch.slug);
                  }}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
            {!channels?.length && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhum canal
              </p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main monitoring area */}
      <div className="flex-1 flex flex-col min-w-0">
        {slug ? (
          <>
            <div className="flex items-center justify-between border-b px-4 py-2">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{slug}</span>
              </div>
              <ConnectionBadge connected={connected} />
            </div>
            <EventStream events={events} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-2">
              <Radio className="h-12 w-12 text-muted-foreground/30 mx-auto" />
              <p className="text-muted-foreground text-sm">
                Selecione um canal para monitorar
              </p>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Excluir Canal"
        description={`Excluir canal ${deleteTarget}?`}
        confirmText="Excluir"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) deleteChannel.mutate(deleteTarget);
        }}
      />
    </div>
  );
}

// --- Connection badge ---

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs gap-1",
        connected ? "text-emerald-600 border-emerald-600/30" : "text-destructive border-destructive/30",
      )}
    >
      <Circle
        className={cn(
          "h-2 w-2",
          connected ? "fill-emerald-500" : "fill-destructive",
        )}
      />
      {connected ? "Conectado" : "Desconectado"}
    </Badge>
  );
}

// --- Event stream ---

function EventStream({ events }: { events: ChannelEvent[] }) {
  if (!events.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Aguardando eventos...
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-3 space-y-2">
        {events.map((evt, i) => (
          <div
            key={`${evt.ts}-${i}`}
            className="flex items-start gap-3 rounded-md border px-3 py-2 text-sm"
          >
            <span className="shrink-0 text-xs text-muted-foreground font-mono tabular-nums whitespace-nowrap pt-0.5">
              {new Date(evt.ts).toLocaleTimeString()}
            </span>
            <Badge variant="secondary" className="shrink-0 text-xs">
              {evt.type}
            </Badge>
            <pre className="flex-1 min-w-0 text-xs text-muted-foreground whitespace-pre-wrap break-all">
              {truncate(JSON.stringify(evt.data, null, 2), 500)}
            </pre>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "..." : str;
}
