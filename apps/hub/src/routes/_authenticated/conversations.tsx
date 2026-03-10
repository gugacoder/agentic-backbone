import { useState, useMemo, useEffect } from "react";
import { createFileRoute, useNavigate, useMatch } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Plus, Search, Bot, User } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
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

export const Route = createFileRoute("/_authenticated/conversations")({
  staticData: { title: "Conversas", description: "Histórico de conversas com agentes" },
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

function ConversationItem({
  conversation,
  agentLabel,
  onClick,
}: {
  conversation: Conversation;
  agentLabel: string;
  onClick: () => void;
}) {
  const hasOperator = !!conversation.takeover_by;

  return (
    <button
      type="button"
      className="flex w-full items-center gap-4 rounded-lg border px-4 py-3 text-left transition-colors hover:bg-muted/50"
      onClick={onClick}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
        <MessageSquare className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="shrink-0 text-xs">
            <Bot className="mr-1 size-3" />
            {agentLabel}
          </Badge>
          {hasOperator && (
            <Badge variant="default" className="shrink-0 text-xs">
              <User className="mr-1 size-3" />
              Operador
            </Badge>
          )}
          <span className="truncate text-sm font-medium">
            {conversation.title || "Sem titulo"}
          </span>
        </div>
        {conversation.lastMessage && (
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {conversation.lastMessage}
          </p>
        )}
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatRelativeTime(conversation.updatedAt)}
      </span>
    </button>
  );
}

function ConversationsLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [operatorFilter, setOperatorFilter] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>("");

  const isNewRoute = useMatch({ from: "/_authenticated/conversations/new", shouldThrow: false });

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por titulo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select
          value={agentFilter}
          onValueChange={(v) => v && setAgentFilter(v)}
        >
          <SelectTrigger>
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
        <Button
          variant={operatorFilter ? "default" : "outline"}
          size="sm"
          onClick={() => setOperatorFilter((v) => !v)}
          className="shrink-0"
        >
          <User className="mr-1 size-4" />
          Com operador
        </Button>
        <div className="sm:ml-auto">
          <Button size="sm" onClick={() => navigate({ to: "/conversations/new" })}>
            <Plus className="mr-1 size-4" />
            Nova Conversa
          </Button>
        </div>
      </div>

      {loadingConversations ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<MessageSquare />}
          title={
            conversations?.length
              ? "Nenhuma conversa encontrada"
              : "Nenhuma conversa"
          }
          description={
            conversations?.length
              ? "Tente ajustar sua busca ou filtro."
              : "Inicie uma conversa com um agente para comecar."
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              agentLabel={getAgentLabel(agents, conv.agentId)}
              onClick={() =>
                navigate({ to: `/conversations/${conv.id}` as string })
              }
            />
          ))}
        </div>
      )}

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
