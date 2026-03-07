import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface Conversation {
  id: string;
  agentId: string;
  title?: string;
  lastMessage?: string;
  updatedAt: string;
}

export function conversationsQueryOptions() {
  return queryOptions({
    queryKey: ["conversations"],
    queryFn: () => request<Conversation[]>("/conversations"),
  });
}

export function conversationQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["conversations", id],
    queryFn: () => request<Conversation>(`/conversations/${id}`),
  });
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export function conversationMessagesQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["conversations", id, "messages"],
    queryFn: () =>
      request<ConversationMessage[]>(`/conversations/${id}/messages`),
  });
}

export async function createConversation(agentId: string): Promise<Conversation> {
  return request<Conversation>("/conversations", {
    method: "POST",
    body: JSON.stringify({ agentId }),
  });
}
