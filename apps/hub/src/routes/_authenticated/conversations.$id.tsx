import { useState, useRef, useCallback } from "react";
import {
  createFileRoute,
  Link,
  useNavigate,
} from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bot, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  conversationQueryOptions,
  conversationMessagesQueryOptions,
  type ConversationMessage,
} from "@/api/conversations";
import { agentsQueryOptions } from "@/api/agents";
import { MessageList } from "@/components/chat/message-list";
import type { ChatMessage } from "@/components/chat/message-bubble";
import { streamMessage, type ChatStreamEvent } from "@/lib/chat-stream";

export const Route = createFileRoute("/_authenticated/conversations/$id")({
  component: ConversationChatPage,
});

function ConversationChatPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: conversation, isLoading: convLoading } = useQuery(
    conversationQueryOptions(id),
  );
  const { data: rawMessages, isLoading: msgsLoading } = useQuery(
    conversationMessagesQueryOptions(id),
  );
  const { data: agents } = useQuery(agentsQueryOptions());

  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState<string | undefined>(
    undefined,
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState("");

  const agentLabel =
    agents?.find((a) => a.id === conversation?.agentId)?.slug ??
    conversation?.agentId ??
    "";

  const historyMessages: ChatMessage[] = (rawMessages ?? []).map(
    (m: ConversationMessage) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
    }),
  );

  const allMessages = [...historyMessages, ...localMessages];

  const handleSend = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;

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
    [id, isStreaming, queryClient],
  );

  function handleAbort() {
    abortRef.current?.abort();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(inputValue);
    }
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

  return (
    <div className="flex h-[calc(100vh-theme(spacing.12)-2rem)] flex-col">
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
      </div>

      {/* Message area */}
      <MessageList
        messages={allMessages}
        streamingContent={streamingContent}
      />

      {/* Input area */}
      <div className="border-t px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            rows={1}
            disabled={isStreaming}
            className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border bg-background px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            onInput={(e) => {
              const target = e.currentTarget;
              target.style.height = "auto";
              target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
            }}
          />
          {isStreaming ? (
            <Button
              variant="destructive"
              size="sm"
              className="shrink-0"
              onClick={handleAbort}
            >
              Parar
            </Button>
          ) : (
            <Button
              size="sm"
              className="shrink-0"
              disabled={!inputValue.trim()}
              onClick={() => handleSend(inputValue)}
            >
              Enviar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
