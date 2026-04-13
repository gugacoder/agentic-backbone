import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useMatch, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PanelLeft,
  PanelLeftClose,
  User,
  Plus,
  MoreVertical,
  Bot,
  Pencil,
  Download,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  conversationsQueryOptions,
  conversationQueryOptions,
  createConversation,
  renameConversation,
  starConversation,
  deleteConversation,
  type Conversation,
} from "@/api/conversations";
import { agentsQueryOptions } from "@/api/agents";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { ConversationList, groupConversations } from "@agentic-backbone/ai-chat";

const PAGE_SIZE = 50;

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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Detect active conversation from current pathname
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const convIdMatch = pathname.match(/\/conversations\/([^/]+)$/);
  const activeId = convIdMatch?.[1];

  const isNewRouteMatch = useMatch({ from: "/_authenticated/conversations/new", shouldThrow: false });
  const isNewRoute = !fixedAgentId ? isNewRouteMatch : null;

  const { data: conversations, isLoading: loadingConversations } = useQuery(
    conversationsQueryOptions(),
  );
  const { data: agents } = useQuery(agentsQueryOptions());

  // Active conversation metadata (for topbar title + actions)
  const { data: activeConversation } = useQuery({
    ...conversationQueryOptions(activeId!),
    enabled: !!activeId,
  });

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (activeId) queryClient.invalidateQueries({ queryKey: ["conversations", activeId] });
    },
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      navigate({ to: basePath as string });
      setDeleteTarget(null);
    },
  });

  // Rename / Delete dialog state
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const sorted = useMemo(() => {
    if (!conversations) return [];
    return [...conversations].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [conversations]);

  const filtered = useMemo(() => {
    return sorted.filter((c) => {
      const matchesSearch = !search || (c.title ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesAgent = agentFilter === "all" || c.agentId === agentFilter;
      const matchesOperator = !operatorFilter || !!c.takeover_by;
      return matchesSearch && matchesAgent && matchesOperator;
    });
  }, [sorted, search, agentFilter, operatorFilter]);

  const { favorites, history } = useMemo(() => groupConversations(filtered), [filtered]);
  const visibleHistory = useMemo(() => history.slice(0, historyLimit), [history, historyLimit]);

  const agentOptions = useMemo(() => agents?.filter((a) => a.enabled) ?? [], [agents]);

  useEffect(() => {
    if (isNewRoute && agentOptions.length > 0 && !selectedAgent) {
      setSelectedAgent(agentOptions[0].id);
    }
  }, [isNewRoute, agentOptions, selectedAgent]);

  const usedAgentIds = useMemo(
    () => new Set((conversations ?? []).map((c) => c.agentId)),
    [conversations],
  );
  const filterAgents = useMemo(
    () => (agents ?? []).filter((a) => usedAgentIds.has(a.id)),
    [agents, usedAgentIds],
  );

  function handleNewConversation() {
    if (fixedAgentId) {
      createMutation.mutate(fixedAgentId);
    } else {
      navigate({ to: `${basePath}/new` as string });
    }
  }

  const handleSelect = useCallback((id: string) => {
    navigate({ to: `${basePath}/${id}` as string });
    if (isMobile) setSheetOpen(false);
  }, [navigate, basePath, isMobile]);

  function handleExport() {
    if (!activeId) return;
    const url = `/api/v1/ai/conversations/${activeId}/export`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversation-${activeId}.json`;
    a.click();
  }

  const agentLabel =
    agents?.find((a) => a.id === activeConversation?.agentId)?.slug ??
    activeConversation?.agentId ??
    "";

  // ── Sidebar content (shared between desktop and mobile sheet) ──

  const sidebarContent = (
    <ConversationList
      conversations={filtered}
      favorites={favorites}
      history={visibleHistory}
      activeId={activeId}
      isLoading={loadingConversations}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Buscar..."
      favoritesLabel="Favoritos"
      historyLabel="Histórico"
      loadMoreLabel="Carregar mais"
      emptyTitle="Nenhuma conversa"
      emptyDescription="Inicie uma conversa com um agente."
      onSelect={handleSelect}
      onRename={(id, title) => renameMutation.mutate({ id, title })}
      onStar={(id, starred) => starMutation.mutate({ id, starred })}
      onCreateRequest={handleNewConversation}
      getAgentLabel={(agentId) => agents?.find((a) => a.id === agentId)?.slug ?? agentId}
      hasMore={history.length > historyLimit}
      onLoadMore={() => setHistoryLimit((l) => l + PAGE_SIZE)}
      remainingCount={history.length - historyLimit}
      headerExtra={
        <Button
          variant={operatorFilter ? "default" : "ghost"}
          size="icon"
          className="size-8 shrink-0"
          onClick={() => setOperatorFilter((v) => !v)}
          title="Filtrar com operador"
        >
          <User className="size-3.5" />
        </Button>
      }
      filterExtra={
        !fixedAgentId && filterAgents.length > 1 ? (
          <Select value={agentFilter} onValueChange={(v) => v && setAgentFilter(v)}>
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
        ) : null
      }
      itemBadgesExtra={(conv) => {
        const c = conv as Conversation;
        return c.takeover_by ? (
          <Badge variant="default" className="shrink-0 px-1.5 py-0 text-[10px]">
            <User className="mr-0.5 size-2.5" /> Op
          </Badge>
        ) : null;
      }}
      className="h-full"
    />
  );

  return (
    <div className="flex h-[calc(100vh-theme(spacing.14)-2rem)] flex-col overflow-hidden">
      {/* ── Topbar ── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div className="flex min-w-0 items-center gap-3">
          {/* Sidebar toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => isMobile ? setSheetOpen((v) => !v) : setSidebarOpen((v) => !v)}
          >
            {(isMobile ? sheetOpen : sidebarOpen)
              ? <PanelLeftClose className="size-4" />
              : <PanelLeft className="size-4" />}
          </Button>

          {/* Active conversation title */}
          {activeConversation ? (
            <>
              <span className="truncate text-sm font-medium">
                {activeConversation.title || "Sem título"}
              </span>
              <Badge variant="outline" className="shrink-0 text-xs">
                <Bot className="mr-1 size-3" />
                {agentLabel}
              </Badge>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">Conversas</span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* New conversation */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleNewConversation}
            title="Nova conversa"
          >
            <Plus className="size-4" />
          </Button>

          {/* Actions dropdown (only when conversation is active) */}
          {activeId && activeConversation && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setRenameTarget({ id: activeId, title: activeConversation.title ?? "" })}>
                  <Pencil className="mr-2 size-4" />
                  Renomear
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExport}>
                  <Download className="mr-2 size-4" />
                  Exportar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setDeleteTarget(activeId)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 size-4" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {/* ── Body: sidebar + chat ── */}
      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar */}
        {!isMobile && sidebarOpen && (
          <div className="w-[280px] shrink-0 border-r">
            {sidebarContent}
          </div>
        )}

        {/* Mobile drawer */}
        {isMobile && (
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetContent side="left" className="w-[280px] p-0">
              <SheetTitle className="sr-only">Histórico de conversas</SheetTitle>
              {sidebarContent}
            </SheetContent>
          </Sheet>
        )}

        {/* Chat outlet */}
        <main className="flex-1 min-h-0 overflow-hidden">
          <Outlet />
        </main>
      </div>

      {/* ── Rename dialog ── */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => { if (!open) setRenameTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear conversa</DialogTitle>
          </DialogHeader>
          <Input
            value={renameTarget?.title ?? ""}
            onChange={(e) => setRenameTarget((prev) => prev ? { ...prev, title: e.target.value } : prev)}
            placeholder="Título da conversa"
            onKeyDown={(e) => {
              if (e.key === "Enter" && renameTarget?.title.trim()) {
                renameMutation.mutate({ id: renameTarget.id, title: renameTarget.title.trim() });
                setRenameTarget(null);
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (renameTarget?.title.trim()) {
                  renameMutation.mutate({ id: renameTarget.id, title: renameTarget.title.trim() });
                  setRenameTarget(null);
                }
              }}
              disabled={!renameTarget?.title.trim() || renameMutation.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir conversa</DialogTitle>
            <DialogDescription>
              Esta conversa será removida permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget); }}
              disabled={deleteMutation.isPending}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New conversation dialog (general mode only) ── */}
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
                        <span className="ml-2 text-muted-foreground">— {a.description}</span>
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
                  onClick={() => { if (selectedAgent) createMutation.mutate(selectedAgent); }}
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
