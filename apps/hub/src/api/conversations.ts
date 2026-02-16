import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Session, ChatMessage } from "./types";

export function conversationsQuery(agentId?: string) {
  return queryOptions({
    queryKey: ["conversations", agentId ?? "all"],
    queryFn: () =>
      api.get<Session[]>(
        agentId ? `/conversations?agentId=${encodeURIComponent(agentId)}` : "/conversations"
      ),
    enabled: !!agentId,
  });
}

export function conversationMessagesQuery(sessionId: string) {
  return queryOptions({
    queryKey: ["conversations", sessionId, "messages"],
    queryFn: () => api.get<ChatMessage[]>(`/conversations/${sessionId}/messages`),
    enabled: !!sessionId,
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (agentId: string) =>
      api.post<Session>("/conversations", { agentId }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["conversations", data.agent_id] });
    },
  });
}

export function useUpdateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, title }: { sessionId: string; title: string }) =>
      api.patch<Session>(`/conversations/${sessionId}`, { title }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["conversations", data.agent_id] });
    },
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => api.delete(`/conversations/${sessionId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}
