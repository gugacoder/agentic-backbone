import { useState, useMemo, useEffect } from "react";
import { createFileRoute, useNavigate, useMatch, Outlet } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Plus, Search, Bot, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  conversationsQueryOptions,
  createConversation,
  type Conversation,
} from "@/api/conversations";
import { agentsQueryOptions, type Agent } from "@/api/agents";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type ConversationsSearch = { agent?: string };

export const Route = createFileRoute("/_authenticated/conversations")({
  staticData: { title: "Conversas", description: "Histórico de conversas com agentes" },
  validateSearch: (search: Record<string, unknown>): ConversationsSearch => ({
    agent: typeof search.agent === "string" ? search.agent : undefined,
  }),
  component: ConversationsLayout,
});

function formatRelativeTime(dateStr: string): string {
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

function getAgentLabel(agents: Agent[] | undefined, agentId: string): string {
  if (!agents) return agentId;
  const agent = agents.find((a) => a.id === agentId);
  return agent?.slug ?? agentId;
}

function ConversationListItem({
  conversation,
  agentLabel,
  isActive,
  onClick,
}: {
  conversation: Conversation;
  agentLabel: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const hasOperator = !!conversation.takeover_by;

  return (
    <button
      type="button"
      className={cn(
        "flex w-full flex-col gap-1 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
        isActive && "bg-accent",
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
          <Bot className="mr-0.5 size-2.5" />
          {agentLabel}
        </Badge>
        {hasOperator && (
          <Badge variant="default" className="shrink-0 px-1.5 py-0 text-[10px]">
            <User className="mr-0.5 size-2.5" />
            Op
          </Badge>
        )}
        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
          {formatRelativeTime(conversation.updatedAt)}
        </span>
      </div>
      <span className="truncate text-sm font-medium">
        {conversation.title || "Sem titulo"}
      </span>
      {conversation.lastMessage && (
        <p className="truncate text-xs text-muted-foreground">
          {conversation.lastMessage}
        </p>
      )}
    </button>
  );
}

function ConversationsLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { agent: agentParam } = Route.useSearch();
  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState<string>(agentParam ?? "all");
  const [operatorFilter, setOperatorFilter] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>("");

  const isNewRoute = useMatch({ from: "/_authenticated/conversations/new", shouldThrow: false });
  const activeMatch = useMatch({ from: "/_authenticated/conversations/$id", shouldThrow: false });
  const activeId = activeMatch?.params?.id;
  const hasActiveChat = !!activeId;

  const { data: conversations, isLoading: loadingConversations } = useQuery(
    conversationsQueryOptions(),
  );
  const { data: agents } = useQuery(agentsQueryOptions());

  const createMutation = useMutation({
    mutationFn: (agentId: string) => createConversation(agentId),
    onSuccess: (conv) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setSelectedAgent("");
      navigate({ to: `/conversations/${conv.id}` as string });
    },
  });

  const sorted = useMemo(() => {
    if (!conversations) return [];
    return [...conversations].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [conversations]);

  const filtered = useMemo(() => {
    return sorted.filter((c) => {
      const matchesSearch =
        !search ||
        (c.title ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesAgent =
        agentFilter === "all" || c.agentId === agentFilter;
      const matchesOperator = !operatorFilter || !!c.takeover_by;
      return matchesSearch && matchesAgent && matchesOperator;
    });
  }, [sorted, search, agentFilter, operatorFilter]);

  const agentOptions = useMemo(() => {
    if (!agents) return [];
    return agents.filter((a) => a.enabled);
  }, [agents]);

  useEffect(() => {
    if (isNewRoute && agentOptions.length > 0 && !selectedAgent) {
      setSelectedAgent(agentOptions[0].id);
    }
  }, [isNewRoute, agentOptions, selectedAgent]);

  const usedAgentIds = useMemo(() => {
    if (!conversations) return new Set<string>();
    return new Set(conversations.map((c) => c.agentId));
  }, [conversations]);

  const filterAgents = useMemo(() => {
    if (!agents) return [];
    return agents.filter((a) => usedAgentIds.has(a.id));
  }, [agents, usedAgentIds]);

  function handleCreate() {
    if (!selectedAgent) return;
    createMutation.mutate(selectedAgent);
  }

  // Mobile: hide list when chat is active
  const showList = !isMobile || !hasActiveChat;
  // Mobile: hide outlet when no chat (show only list)
  const showOutlet = !isMobile || hasActiveChat;

  return (
    <div className="flex h-[calc(100vh-theme(spacing.12)-2rem)] overflow-hidden">
      {/* Left panel: conversation list */}
      {showList && (
        <aside className={cn(
          "flex shrink-0 flex-col overflow-hidden border-r",
          isMobile ? "w-full" : "w-80",
        )}>
          {/* List header */}
          <div className="flex items-center gap-2 border-b px-3 py-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-7 text-sm"
              />
            </div>
            <Button
              variant={operatorFilter ? "default" : "ghost"}
              size="icon"
              className="size-8 shrink-0"
              onClick={() => setOperatorFilter((v) => !v)}
              title="Filtrar com operador"
            >
              <User className="size-3.5" />
            </Button>
            <Button
              size="icon"
              className="size-8 shrink-0"
              onClick={() => navigate({ to: "/conversations/new" })}
              title="Nova conversa"
            >
              <Plus className="size-3.5" />
            </Button>
          </div>

          {/* Agent filter */}
          {filterAgents.length > 1 && (
            <div className="border-b px-3 py-1.5">
              <Select
                value={agentFilter}
                onValueChange={(v) => v && setAgentFilter(v)}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Todos os agentes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os agentes</SelectItem>
                  {filterAgents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.slug}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {loadingConversations ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                <MessageSquare className="mb-2 size-8 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {conversations?.length
                    ? "Nenhuma conversa encontrada"
                    : "Nenhuma conversa"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {conversations?.length
                    ? "Tente ajustar sua busca ou filtro."
                    : "Inicie uma conversa com um agente."}
                </p>
              </div>
            ) : (
              <div className="space-y-0.5 p-1.5">
                {filtered.map((conv) => (
                  <ConversationListItem
                    key={conv.id}
                    conversation={conv}
                    agentLabel={getAgentLabel(agents, conv.agentId)}
                    isActive={conv.id === activeId}
                    onClick={() =>
                      navigate({ to: `/conversations/${conv.id}` as string })
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Right panel: chat or empty state */}
      {showOutlet && (
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      )}

      {/* New conversation dialog */}
      <Dialog
        open={!!isNewRoute}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAgent("");
            navigate({ to: "/conversations" });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Conversa</DialogTitle>
            <DialogDescription>
              Escolha um agente para iniciar a conversa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select
              value={selectedAgent}
              onValueChange={(v) => v && setSelectedAgent(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione um agente" />
              </SelectTrigger>
              <SelectContent>
                {agentOptions.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.slug}
                    {a.description && (
                      <span className="ml-2 text-muted-foreground">
                        — {a.description}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => navigate({ to: "/conversations" })}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!selectedAgent || createMutation.isPending}
              >
                {createMutation.isPending ? "Criando..." : "Iniciar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
