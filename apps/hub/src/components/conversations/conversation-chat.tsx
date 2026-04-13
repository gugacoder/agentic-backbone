import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { GitMerge } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  conversationQueryOptions,
  conversationMessagesQueryOptions,
  sessionQueryOptions,
  takeoverConversation,
  releaseConversation,
} from "@/api/conversations";
import { Chat, defaultDisplayRenderers } from "@agentic-backbone/ai-chat";
import { TakeoverButton } from "@/components/conversations/takeover-button";
import { TakeoverBanner } from "@/components/conversations/takeover-banner";
import { ApprovalInlineActions } from "@/components/approvals/approval-inline-actions";

type BackendMessage = import("@/api/conversations").ConversationMessage;

function buildInitialMessages(messages?: BackendMessage[]) {
  if (!messages || !Array.isArray(messages) || messages.length === 0) return undefined;

  type Part = { type?: string; text?: string; toolCallId?: string; toolName?: string; input?: Record<string, unknown>; output?: unknown };

  const toolResults = new Map<string, { toolName: string; result: unknown }>();
  for (const m of messages) {
    if (m.role === "tool" && Array.isArray(m.content)) {
      for (const part of m.content as Part[]) {
        if (part.type === "tool-result" && part.toolCallId) {
          const raw = part.output as { type?: string; value?: unknown } | unknown;
          const value = (typeof raw === "object" && raw !== null && "type" in (raw as Record<string, unknown>) && (raw as Record<string, unknown>).type === "json")
            ? (raw as { value: unknown }).value
            : raw;
          toolResults.set(part.toolCallId, { toolName: part.toolName ?? "", result: value });
        }
      }
    }
  }

  const result: { id: string; role: "user" | "assistant"; content: string; parts?: unknown[] }[] = [];
  let i = 0;

  while (i < messages.length) {
    const m = messages[i]!;

    if (m.role === "user") {
      let content = "";
      const parts: unknown[] = [];

      if (typeof m.content === "string") {
        content = m.content;
      } else if (Array.isArray(m.content)) {
        for (const p of m.content as Record<string, unknown>[]) {
          if (p["type"] === "text") {
            const text = String(p["text"] ?? "");
            if (!text.startsWith("[📎") && !content) content = text;
            parts.push(p);
          } else if (p["type"] === "image" || p["type"] === "file") {
            parts.push({ type: p["type"], _ref: p["_ref"], mimeType: p["mimeType"] });
          } else {
            parts.push(p);
          }
        }
      }

      result.push({
        id: m._meta?.id ?? m.id ?? `msg-${i}`,
        role: "user",
        content,
        ...(parts.length > 0 ? { parts } : {}),
      });
      i++;
      continue;
    }

    if (m.role === "tool") {
      i++;
      continue;
    }

    if (m.role === "assistant") {
      const parts: unknown[] = [];
      let textContent = "";
      const id = m._meta?.id ?? m.id ?? `msg-${i}`;

      while (i < messages.length && (messages[i]!.role === "assistant" || messages[i]!.role === "tool")) {
        const cur = messages[i]!;

        if (cur.role === "tool") {
          i++;
          continue;
        }

        if (typeof cur.content === "string") {
          if (cur.content) {
            parts.push({ type: "text", text: cur.content });
            textContent += cur.content;
          }
        } else if (Array.isArray(cur.content)) {
          for (const p of cur.content as Part[]) {
            if (p.type === "text" && p.text) {
              parts.push({ type: "text", text: p.text });
              textContent += p.text;
            } else if (p.type === "tool-call" && p.toolCallId) {
              const tr = toolResults.get(p.toolCallId);
              parts.push({
                type: "tool-invocation",
                toolInvocation: {
                  toolName: p.toolName ?? "",
                  toolCallId: p.toolCallId,
                  state: tr ? "result" : "call",
                  args: p.input,
                  result: tr?.result,
                },
              });
            }
          }
        }
        i++;
      }

      result.push({ id, role: "assistant", content: textContent, parts });
      continue;
    }

    i++;
  }

  return result;
}

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
  const { data: existingMessages, isLoading: msgsLoading } = useQuery(
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
  const token = ""; // auth via HttpOnly cookie — no token needed in header

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
        {/* Takeover controls (thin bar, only when relevant) */}
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

        {/* Chat — rich content enabled */}
        <Chat
          endpoint=""
          token={token}
          sessionId={id}
          initialMessages={buildInitialMessages(existingMessages)}
          displayRenderers={defaultDisplayRenderers}
          enableRichContent
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
