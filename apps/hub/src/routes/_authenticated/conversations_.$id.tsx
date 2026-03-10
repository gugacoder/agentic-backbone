import { useState, useRef, useCallback, useEffect } from "react";
import {
  createFileRoute,
  Link,
  useNavigate,
} from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bot,
  ChevronRight,
  MoreVertical,
  Pencil,
  Download,
  Trash2,
  GitMerge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  conversationQueryOptions,
  conversationMessagesQueryOptions,
  sessionQueryOptions,
  renameConversation,
  deleteConversation,
  takeoverConversation,
  releaseConversation,
  type ConversationMessage,
} from "@/api/conversations";
import { agentsQueryOptions } from "@/api/agents";
import { MessageList } from "@/components/chat/message-list";
import { MessageInput } from "@/components/chat/message-input";
import type { ChatMessage } from "@/components/chat/message-bubble";
import { streamMessage, type ChatStreamEvent } from "@/lib/chat-stream";
import { useAuthStore } from "@/lib/auth";
import { TakeoverButton } from "@/components/conversations/takeover-button";
import { TakeoverBanner } from "@/components/conversations/takeover-banner";
import { ApprovalInlineActions } from "@/components/approvals/approval-inline-actions";

type ConversationSearch = { action?: "rename" | "delete" };

export const Route = createFileRoute("/_authenticated/conversations_/$id")({
  staticData: { title: "Conversa" },
  validateSearch: (search: Record<string, unknown>): ConversationSearch => ({
    action:
      search.action === "rename" || search.action === "delete"
        ? search.action
        : undefined,
  }),
  component: ConversationChatPage,
});

function getCurrentUserSlug(): string | null {
  const token = useAuthStore.getState().token;
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1]!)) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

function ConversationChatPage() {
  const { id } = Route.useParams();
  const { action } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: conversation, isLoading: convLoading } = useQuery(
    conversationQueryOptions(id),
  );
  const { data: rawMessages, isLoading: msgsLoading } = useQuery(
    conversationMessagesQueryOptions(id),
  );
  const { data: agents } = useQuery(agentsQueryOptions());
  const { data: session } = useQuery(sessionQueryOptions(id));

  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState<string | undefined>(
    undefined,
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    if (action === "rename") {
      setRenameValue(conversation?.title ?? "");
    }
  }, [action, conversation?.title]);

  const renameMutation = useMutation({
    mutationFn: (title: string) => renameConversation(id, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations", id] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      navigate({ search: {} });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      navigate({ to: "/conversations" });
    },
  });

  const takeoverMutation = useMutation({
    mutationFn: () => takeoverConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations", id, "session"] });
    },
  });

  const releaseMutation = useMutation({
    mutationFn: () => releaseConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations", id, "session"] });
    },
  });

  const currentUserSlug = getCurrentUserSlug();
  const isUnderTakeover = session?.takeover_by != null;
  const isCurrentOperator =
    isUnderTakeover && session?.takeover_by === currentUserSlug;

  function handleExport() {
    const token = useAuthStore.getState().token;
    const url = `/api/v1/ai/conversations/${id}/export${token ? `?token=${encodeURIComponent(token)}` : ""}`;
    window.open(url, "_blank");
  }

  const agentLabel =
    agents?.find((a) => a.id === conversation?.agentId)?.slug ??
    conversation?.agentId ??
    "";

  const historyMessages: ChatMessage[] = (rawMessages ?? []).map(
    (m: ConversationMessage) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      metadata: m.metadata,
      feedback: m.feedback,
    }),
  );

  const allMessages = [...historyMessages, ...localMessages];

  const handleSend = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;

      if (isCurrentOperator) {
        // Operator mode: add message optimistically as operator style, skip streaming display
        const operatorMsg: ChatMessage = {
          role: "assistant",
          content: content.trim(),
          metadata: { operator: true, operatorSlug: currentUserSlug ?? "Operador" },
        };
        setLocalMessages((prev) => [...prev, operatorMsg]);
        setInputValue("");
        setIsStreaming(true);

        const controller = new AbortController();
        abortRef.current = controller;

        try {
          await streamMessage(
            id,
            content.trim(),
            () => {
              // Ignore events — operator message already shown optimistically
            },
            controller.signal,
          );
        } catch (err) {
          if ((err as Error).name === "AbortError") {
            // aborted, nothing to do
          }
        } finally {
          setIsStreaming(false);
          abortRef.current = null;
          queryClient.invalidateQueries({
            queryKey: ["conversations", id, "messages"],
          });
        }
        return;
      }

      // Normal mode
      const userMsg: ChatMessage = { role: "user", content: content.trim() };
      setLocalMessages((prev) => [...prev, userMsg]);
      setInputValue("");
      setStreamingContent("");
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        let accumulated = "";
        let gotResult = false;
        await streamMessage(
          id,
          content.trim(),
          (event: ChatStreamEvent) => {
            if (event.type === "text" && event.content) {
              accumulated += event.content;
              setStreamingContent(accumulated);
            } else if (event.type === "result" && event.content) {
              gotResult = true;
              setStreamingContent(undefined);
              setLocalMessages((prev) => [
                ...prev,
                { role: "assistant", content: event.content! },
              ]);
            }
          },
          controller.signal,
        );

        // If no result event came, use accumulated text
        if (!gotResult && accumulated) {
          setStreamingContent(undefined);
          setLocalMessages((prev) => [
            ...prev,
            { role: "assistant", content: accumulated },
          ]);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setStreamingContent(undefined);
          setLocalMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Erro ao processar resposta." },
          ]);
        } else {
          setStreamingContent(undefined);
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
        queryClient.invalidateQueries({
          queryKey: ["conversations", id, "messages"],
        });
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      }
    },
    [id, isStreaming, isCurrentOperator, currentUserSlug, queryClient],
  );

  function handleAbort() {
    abortRef.current?.abort();
  }

  if (convLoading || msgsLoading) {
    return (
      <div className="flex h-full flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full flex-1" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Conversa nao encontrada.</p>
        <Link
          to="/conversations"
          className="text-sm text-primary underline"
        >
          Voltar para Conversas
        </Link>
      </div>
    );
  }

  const orchestrationPath: string[] = (() => {
    try {
      return session?.orchestration_path
        ? (JSON.parse(session.orchestration_path) as string[])
        : [];
    } catch {
      return [];
    }
  })();

  return (
    <div className="flex h-[calc(100vh-theme(spacing.12)-2rem)] gap-3">
      <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={() => navigate({ to: "/conversations" })}
        >
          <ArrowLeft className="size-4" />
        </Button>

        <nav className="hidden items-center gap-1 text-sm text-muted-foreground sm:flex">
          <Link
            to="/conversations"
            className="transition-colors hover:text-foreground"
          >
            Conversas
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="font-medium text-foreground">
            {conversation.title || "Sem titulo"}
          </span>
        </nav>

        <span className="truncate text-sm font-medium sm:hidden">
          {conversation.title || "Sem titulo"}
        </span>

        <Badge variant="outline" className="ml-auto shrink-0 text-xs">
          <Bot className="mr-1 size-3" />
          {agentLabel}
        </Badge>

        {!isUnderTakeover && (
          <TakeoverButton
            sessionId={id}
            onTakeover={() => takeoverMutation.mutate()}
            isPending={takeoverMutation.isPending}
          />
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="size-8 shrink-0">
                <MoreVertical className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => navigate({ search: { action: "rename" } })}>
              <Pencil className="mr-2 size-4" />
              Renomear
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleExport}>
              <Download className="mr-2 size-4" />
              Exportar
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => navigate({ search: { action: "delete" } })}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 size-4" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Rename dialog */}
      <Dialog open={action === "rename"} onOpenChange={(open) => { if (!open) navigate({ search: {} }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear conversa</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Titulo da conversa"
            onKeyDown={(e) => {
              if (e.key === "Enter" && renameValue.trim()) {
                renameMutation.mutate(renameValue.trim());
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => navigate({ search: {} })}>
              Cancelar
            </Button>
            <Button
              onClick={() => renameMutation.mutate(renameValue.trim())}
              disabled={!renameValue.trim() || renameMutation.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={action === "delete"} onOpenChange={(open) => { if (!open) navigate({ search: {} }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir conversa</DialogTitle>
            <DialogDescription>
              Esta conversa sera removida permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => navigate({ search: {} })}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Takeover banner */}
      {isUnderTakeover && session?.takeover_by && session?.takeover_at && (
        <TakeoverBanner
          takenOverBy={session.takeover_by}
          takenOverAt={session.takeover_at}
          onRelease={() => releaseMutation.mutate()}
          isPending={releaseMutation.isPending}
        />
      )}

      {/* Inline approval requests for this session */}
      <ApprovalInlineActions sessionId={id} />

      {/* Message area */}
      <MessageList
        messages={allMessages}
        streamingContent={streamingContent}
        sessionId={id}
      />

      {/* Input area */}
      <MessageInput
        value={inputValue}
        onChange={setInputValue}
        onSend={handleSend}
        onAbort={handleAbort}
        isStreaming={isStreaming}
      />
      </div>

      {/* Orchestration path sidebar */}
      {orchestrationPath.length > 0 && (
        <div className="hidden w-56 shrink-0 overflow-y-auto rounded-lg border bg-muted/30 p-3 lg:block">
          <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <GitMerge className="size-3.5" />
            Caminho de delegacao
          </div>
          <ol className="space-y-2">
            {orchestrationPath.map((agentId, idx) => (
              <li key={idx} className="flex items-center gap-2 text-xs">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                  {idx + 1}
                </span>
                <span className="truncate font-mono">{agentId}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
