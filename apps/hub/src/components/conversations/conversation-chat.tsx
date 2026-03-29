import { useState, useEffect } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bot,
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
  sessionQueryOptions,
  renameConversation,
  deleteConversation,
  takeoverConversation,
  releaseConversation,
} from "@/api/conversations";
import { agentsQueryOptions } from "@/api/agents";
import { Chat } from "@agentic-backbone/ai-chat";
import { useAuthStore } from "@/lib/auth";
import { TakeoverButton } from "@/components/conversations/takeover-button";
import { TakeoverBanner } from "@/components/conversations/takeover-banner";
import { ApprovalInlineActions } from "@/components/approvals/approval-inline-actions";
import { useIsMobile } from "@/hooks/use-mobile";

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

interface ConversationChatPageProps {
  id: string;
  basePath: string;
}

export function ConversationChatPage({ id, basePath }: ConversationChatPageProps) {
  const { action } = useSearch({ strict: false }) as { action?: "rename" | "delete" };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const { data: conversation, isLoading: convLoading } = useQuery(
    conversationQueryOptions(id),
  );
  const { data: agents } = useQuery(agentsQueryOptions());
  const { data: session } = useQuery(sessionQueryOptions(id));

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
      navigate({ to: basePath as string });
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

  function handleExport() {
    const token = useAuthStore.getState().token;
    const url = `/api/v1/ai/conversations/${id}/export${token ? `?token=${encodeURIComponent(token)}` : ""}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversation-${id}.json`;
    a.click();
  }

  const agentLabel =
    agents?.find((a) => a.id === conversation?.agentId)?.slug ??
    conversation?.agentId ??
    "";

  const token = useAuthStore.getState().token ?? "";

  if (convLoading) {
    return (
      <div className="flex h-full flex-col gap-4 p-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full flex-1" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="space-y-4 text-center">
          <p className="text-muted-foreground">Conversa nao encontrada.</p>
          <Link
            to={basePath as string}
            className="text-sm text-primary underline"
          >
            Voltar para Conversas
          </Link>
        </div>
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
    <div className="chat-active flex h-full gap-3">
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              onClick={() => navigate({ to: basePath as string })}
            >
              <ArrowLeft className="size-4" />
            </Button>
          )}

          <span className="truncate text-sm font-medium">
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
              <DropdownMenuItem onClick={() => navigate({ search: { action: "rename" } })}>
                <Pencil className="mr-2 size-4" />
                Renomear
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExport}>
                <Download className="mr-2 size-4" />
                Exportar
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate({ search: { action: "delete" } })}
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

        {/* Chat area — delegates message list + input to ai-chat */}
        <Chat
          endpoint=""
          token={token}
          sessionId={id}
          className="flex-1 flex flex-col overflow-hidden"
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
