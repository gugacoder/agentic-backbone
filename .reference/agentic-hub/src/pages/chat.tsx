import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { agentsQuery } from "@/api/agents";
import { conversationsQuery, useCreateConversation, useDeleteConversation } from "@/api/conversations";
import { useChat } from "@/hooks/use-chat";
import { useIsMobile } from "@/hooks/use-mobile";
import { MessageList } from "@/components/chat/message-list";
import { MessageInput } from "@/components/chat/message-input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Plus, Trash2, MessageSquare, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import type { Session } from "@/api/types";

export function ChatPage() {
  const isMobile = useIsMobile();
  const params = useParams({ strict: false }) as { agentId?: string; sessionId?: string };
  const agentId = params.agentId;
  const sessionId = params.sessionId;
  const navigate = useNavigate();

  const { data: agents } = useQuery(agentsQuery);
  const availableAgents = agents ?? [];

  const { data: conversations } = useQuery({
    ...conversationsQuery(agentId),
    enabled: !!agentId,
  });

  const createConversation = useCreateConversation();
  const deleteConversation = useDeleteConversation();
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);

  const { messages, isStreaming, isLoading, streamingText, sendMessage, stopStreaming } =
    useChat(sessionId);

  function handleSelectAgent(id: string) {
    navigate({ to: "/chat/$agentId", params: { agentId: id } });
  }

  async function handleNewChat() {
    if (!agentId) return;
    const session = await createConversation.mutateAsync(agentId);
    navigate({ to: "/chat/$agentId/$sessionId", params: { agentId, sessionId: session.session_id } });
  }

  function handleSelectSession(sid: string) {
    if (!agentId) return;
    navigate({ to: "/chat/$agentId/$sessionId", params: { agentId, sessionId: sid } });
  }

  function handleDeleteSession() {
    if (!deleteTarget) return;
    deleteConversation.mutate(deleteTarget.session_id);
    if (sessionId === deleteTarget.session_id) {
      navigate({ to: "/chat/$agentId", params: { agentId: agentId! } });
    }
    setDeleteTarget(null);
  }

  // --- Mobile: progressive depth navigation ---
  if (isMobile) {
    // Level 3: Chat view
    if (agentId && sessionId) {
      return (
        <div className="-m-4 flex flex-col h-[calc(100vh-3rem-3.5rem)]">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate({ to: "/chat/$agentId", params: { agentId } })}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium truncate">{agentId}</span>
          </div>
          <MessageList messages={messages} streamingText={streamingText} isStreaming={isStreaming} />
          <MessageInput onSend={sendMessage} onStop={stopStreaming} isStreaming={isStreaming} disabled={isLoading} />
        </div>
      );
    }

    // Level 2: Conversation list
    if (agentId) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate({ to: "/chat" })}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="font-semibold">{agentId}</h2>
          </div>
          <Button onClick={handleNewChat} disabled={createConversation.isPending} className="w-full">
            <Plus className="h-4 w-4 mr-2" /> New Chat
          </Button>
          {conversations?.length ? (
            <div className="space-y-2">
              {conversations.map((s) => (
                <ConversationRow
                  key={s.session_id}
                  session={s}
                  isActive={false}
                  onClick={() => handleSelectSession(s.session_id)}
                  onDelete={() => setDeleteTarget(s)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No conversations yet. Start a new chat.</p>
          )}
          <ConfirmDialog
            open={!!deleteTarget}
            onOpenChange={() => setDeleteTarget(null)}
            title="Delete Conversation"
            description="Are you sure you want to delete this conversation? This action cannot be undone."
            confirmText="Delete"
            variant="destructive"
            onConfirm={handleDeleteSession}
          />
        </div>
      );
    }

    // Level 1: Agent grid
    return (
      <div className="space-y-4">
        <h2 className="font-semibold">Chat</h2>
        {availableAgents.length ? (
          <div className="grid grid-cols-2 gap-3">
            {availableAgents.map((a) => (
              <Card
                key={a.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSelectAgent(a.id)}
              >
                <CardContent className="flex flex-col items-center gap-2 p-4">
                  <Bot className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm font-medium text-center">{a.id}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">No enabled agents available.</p>
        )}
      </div>
    );
  }

  // --- Desktop: two-panel layout ---
  return (
    <div className="-m-4 md:-m-6 flex h-[calc(100vh-3rem)] overflow-hidden border-t">
      {/* Sidebar */}
      <div className="w-72 shrink-0 border-r flex flex-col overflow-hidden">
        <div className="p-3 border-b">
          <Select value={agentId ?? ""} onValueChange={handleSelectAgent}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an agent" />
            </SelectTrigger>
            <SelectContent>
              {availableAgents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {agentId && (
          <>
            <div className="p-3 border-b">
              <Button onClick={handleNewChat} disabled={createConversation.isPending} className="w-full" size="sm">
                <Plus className="h-4 w-4 mr-2" /> New Chat
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {conversations?.map((s) => (
                  <ConversationRow
                    key={s.session_id}
                    session={s}
                    isActive={s.session_id === sessionId}
                    onClick={() => handleSelectSession(s.session_id)}
                    onDelete={() => setDeleteTarget(s)}
                  />
                ))}
                {!conversations?.length && (
                  <p className="text-xs text-muted-foreground text-center py-4">No conversations</p>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {sessionId ? (
          <>
            <MessageList messages={messages} streamingText={streamingText} isStreaming={isStreaming} />
            <MessageInput onSend={sendMessage} onStop={stopStreaming} isStreaming={isStreaming} disabled={isLoading} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-2">
              <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto" />
              <p className="text-muted-foreground text-sm">
                {agentId ? "Select or start a new conversation" : "Select an agent to begin"}
              </p>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete Conversation"
        description="Are you sure you want to delete this conversation? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDeleteSession}
      />
    </div>
  );
}

// --- Conversation row component ---

function ConversationRow({
  session,
  isActive,
  onClick,
  onDelete,
}: {
  session: Session;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const label = session.title || new Date(session.created_at).toLocaleString();

  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer hover:bg-muted/50",
        isActive && "bg-muted"
      )}
      onClick={onClick}
    >
      <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate flex-1">{label}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
      >
        <Trash2 className="h-3 w-3 text-destructive" />
      </Button>
    </div>
  );
}
