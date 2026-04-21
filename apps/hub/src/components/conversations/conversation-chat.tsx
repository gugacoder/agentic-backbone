import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { GitMerge } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  conversationQueryOptions,
  sessionQueryOptions,
  takeoverConversation,
  releaseConversation,
  conversationMessagesQueryOptions,
} from "@/api/conversations";
import { Chat, defaultDisplayRenderers } from "@codrstudio/openclaude-chat";
import { TakeoverButton } from "@/components/conversations/takeover-button";
import { TakeoverBanner } from "@/components/conversations/takeover-banner";
import { ApprovalInlineActions } from "@/components/approvals/approval-inline-actions";

interface ConversationChatPageProps {
  id: string;
  basePath: string;
}

export function ConversationChatPage({ id, basePath }: ConversationChatPageProps) {
  const queryClient = useQueryClient();

  const { data: conversation, isLoading: convLoading } = useQuery(
    conversationQueryOptions(id),
  );
  const { data: session } = useQuery(sessionQueryOptions(id));
  const { data: initialMessages, isLoading: msgsLoading } = useQuery(
    conversationMessagesQueryOptions(id),
  );

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

  const isUnderTakeover = session?.takeover_by != null;

  if (convLoading || msgsLoading) {
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
          <p className="text-muted-foreground">Conversa não encontrada.</p>
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
    <div className="flex h-full gap-3">
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Takeover controls */}
        {!isUnderTakeover && (
          <div className="flex items-center justify-end border-b px-3 py-1.5">
            <TakeoverButton
              sessionId={id}
              onTakeover={() => takeoverMutation.mutate()}
              isPending={takeoverMutation.isPending}
            />
          </div>
        )}

        {/* Takeover banner */}
        {isUnderTakeover && session?.takeover_by && session?.takeover_at && (
          <TakeoverBanner
            takenOverBy={session.takeover_by}
            takenOverAt={session.takeover_at}
            onRelease={() => releaseMutation.mutate()}
            isPending={releaseMutation.isPending}
          />
        )}

        {/* Inline approval requests */}
        <ApprovalInlineActions sessionId={id} />

        {/* Chat — uses openclaude-chat with /conversations/* routes */}
        <Chat
          key={id}
          endpoint="/api/v1/ai"
          sessionId={id}
          initialMessages={initialMessages ?? []}
          displayRenderers={defaultDisplayRenderers}
          enableRichContent
          locale="pt-BR"
          enableLocaleSelect={false}
          className="flex-1 flex flex-col overflow-hidden"
        />
      </div>

      {/* Orchestration path sidebar */}
      {orchestrationPath.length > 0 && (
        <div className="hidden w-56 shrink-0 overflow-y-auto rounded-lg border bg-muted/30 p-3 lg:block">
          <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <GitMerge className="size-3.5" />
            Caminho de delegação
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
