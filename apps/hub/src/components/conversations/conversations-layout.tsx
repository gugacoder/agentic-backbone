import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useMatch, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Plus, Search, Bot, User, Star, ChevronRight, Pencil } from "lucide-react";
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
  renameConversation,
  starConversation,
  type Conversation,
} from "@/api/conversations";
import { agentsQueryOptions, type Agent } from "@/api/agents";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

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

function CollapsibleGroup({
  label,
  icon,
  open,
  onToggle,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronRight className={cn("size-3 transition-transform", open && "rotate-90")} />
        {icon}
        {label}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

function ConversationListItem({
  conversation,
  agentLabel,
  isActive,
  isRenaming,
  renameValue,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  onStartRename,
  onToggleStar,
  onClick,
}: {
  conversation: Conversation;
  agentLabel: string;
  isActive: boolean;
  isRenaming: boolean;
  renameValue: string;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onStartRename: (e: React.MouseEvent) => void;
  onToggleStar: (e: React.MouseEvent) => void;
  onClick: () => void;
}) {
  const hasOperator = !!conversation.takeover_by;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming]);

  return (
    <div
      className={cn(
        "group flex w-full items-start gap-1.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/50",
        isActive && "bg-accent",
      )}
    >
      {/* Star button */}
      <button
        type="button"
        onClick={onToggleStar}
        className="mt-0.5 shrink-0 p-0.5 text-muted-foreground hover:text-yellow-500 transition-colors"
        title={conversation.starred ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      >
        <Star
          className={cn(
            "size-3.5",
            conversation.starred && "fill-yellow-400 text-yellow-400",
          )}
        />
      </button>

      {/* Main content — clickable area */}
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={onClick}
      >
        <div className="flex items-center gap-1.5">
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

        {isRenaming ? null : (
          <span className="truncate text-sm font-medium block">
            {conversation.title || "Sem titulo"}
          </span>
        )}
      </button>

      {/* Rename input (shown inline when renaming) */}
      {isRenaming && (
        <input
          ref={inputRef}
          value={renameValue}
          onChange={(e) => onRenameChange(e.target.value)}
          onBlur={onRenameCommit}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); onRenameCommit(); }
            if (e.key === "Escape") { e.preventDefault(); onRenameCancel(); }
          }}
          className="min-w-0 flex-1 rounded border border-input bg-background px-1.5 py-0.5 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
      )}

      {/* Edit icon — visible on hover */}
      {!isRenaming && (
        <button
          type="button"
          onClick={onStartRename}
          className="mt-0.5 shrink-0 p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity"
          title="Renomear"
        >
          <Pencil className="size-3" />
        </button>
      )}
    </div>
  );
}

interface ConversationsLayoutProps {
  fixedAgentId?: string;
  basePath: string;
}

export function ConversationsLayout({ fixedAgentId, basePath }: ConversationsLayoutProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState<string>(fixedAgentId ?? "all");
  const [operatorFilter, setOperatorFilter] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [historyLimit, setHistoryLimit] = useState(PAGE_SIZE);
  const [favoritesOpen, setFavoritesOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Detect active conversation from current pathname (works for both /conversations/$id and /agents/$id/conversations/$convId)
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const convIdMatch = pathname.match(/\/conversations\/([^/]+)$/);
  const activeId = convIdMatch?.[1];
  const hasActiveChat = !!activeId;

  // New-conversation dialog is only used in the general (non-fixed) mode
  const isNewRouteMatch = useMatch({ from: "/_authenticated/conversations/new", shouldThrow: false });
  const isNewRoute = !fixedAgentId ? isNewRouteMatch : null;

  const { data: conversations, isLoading: loadingConversations } = useQuery(
    conversationsQueryOptions(),
  );
  const { data: agents } = useQuery(agentsQueryOptions());

  const createMutation = useMutation({
    mutationFn: (agentId: string) => createConversation(agentId),
    onSuccess: (conv) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setSelectedAgent("");
      navigate({ to: `${basePath}/${conv.id}` as string });
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      renameConversation(id, title),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conversations"] }),
    onSettled: () => setRenamingId(null),
  });

  const starMutation = useMutation({
    mutationFn: ({ id, starred }: { id: string; starred: boolean }) =>
      starConversation(id, starred),
    onMutate: async ({ id, starred }) => {
      await queryClient.cancelQueries({ queryKey: ["conversations"] });
      const previous = queryClient.getQueryData<Conversation[]>(["conversations"]);
      queryClient.setQueryData<Conversation[]>(["conversations"], (old) =>
        old?.map((c) => (c.id === id ? { ...c, starred } : c)) ?? []
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["conversations"], ctx.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["conversations"] }),
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

  const favorites = useMemo(() => filtered.filter((c) => c.starred), [filtered]);
  const history = useMemo(() => filtered.filter((c) => !c.starred), [filtered]);
  const visibleHistory = useMemo(() => history.slice(0, historyLimit), [history, historyLimit]);
  const hasMore = history.length > historyLimit;

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

  function handleNewConversation() {
    if (fixedAgentId) {
      createMutation.mutate(fixedAgentId);
    } else {
      navigate({ to: `${basePath}/new` as string });
    }
  }

  function startRename(conv: Conversation, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setRenamingId(conv.id);
    setRenameValue(conv.title ?? "");
  }

  function commitRename() {
    if (!renamingId) return;
    const trimmed = renameValue.trim();
    if (trimmed) {
      renameMutation.mutate({ id: renamingId, title: trimmed });
    } else {
      setRenamingId(null);
    }
  }

  function cancelRename() {
    setRenamingId(null);
  }

  function toggleStar(conv: Conversation, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    starMutation.mutate({ id: conv.id, starred: !conv.starred });
  }

  // Mobile: hide list when chat is active
  const showList = !isMobile || !hasActiveChat;
  // Mobile: hide outlet when no chat (show only list)
  const showOutlet = !isMobile || hasActiveChat;

  function renderConversationItem(conv: Conversation) {
    return (
      <ConversationListItem
        key={conv.id}
        conversation={conv}
        agentLabel={getAgentLabel(agents, conv.agentId)}
        isActive={conv.id === activeId}
        isRenaming={renamingId === conv.id}
        renameValue={renameValue}
        onRenameChange={setRenameValue}
        onRenameCommit={commitRename}
        onRenameCancel={cancelRename}
        onStartRename={(e) => startRename(conv, e)}
        onToggleStar={(e) => toggleStar(conv, e)}
        onClick={() => navigate({ to: `${basePath}/${conv.id}` as string })}
      />
    );
  }

  return (
    <div className="flex h-[calc(100vh-theme(spacing.14)-2rem)] overflow-hidden">
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
              onClick={handleNewConversation}
              disabled={fixedAgentId ? createMutation.isPending : false}
              title="Nova conversa"
            >
              <Plus className="size-3.5" />
            </Button>
          </div>

          {/* Agent filter — hidden in fixed-agent mode */}
          {!fixedAgentId && filterAgents.length > 1 && (
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
              <div className="py-1">
                {/* Favorites group */}
                {favorites.length > 0 && (
                  <CollapsibleGroup
                    label="Favoritos"
                    icon={<Star className="size-3 fill-yellow-400 text-yellow-400" />}
                    open={favoritesOpen}
                    onToggle={() => setFavoritesOpen((v) => !v)}
                  >
                    <div className="space-y-0.5 px-1.5">
                      {favorites.map(renderConversationItem)}
                    </div>
                  </CollapsibleGroup>
                )}

                {/* History group */}
                <CollapsibleGroup
                  label="Histórico"
                  open={historyOpen}
                  onToggle={() => setHistoryOpen((v) => !v)}
                >
                  <div className="space-y-0.5 px-1.5">
                    {visibleHistory.map(renderConversationItem)}
                    {hasMore && (
                      <button
                        type="button"
                        onClick={() => setHistoryLimit((l) => l + PAGE_SIZE)}
                        className="w-full rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                      >
                        Carregar mais ({history.length - historyLimit} restantes)
                      </button>
                    )}
                  </div>
                </CollapsibleGroup>
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

      {/* New conversation dialog — only in general mode (no fixedAgentId) */}
      {!fixedAgentId && (
        <Dialog
          open={!!isNewRoute}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedAgent("");
              navigate({ to: basePath as string });
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
                  onClick={() => navigate({ to: basePath as string })}
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
      )}
    </div>
  );
}
