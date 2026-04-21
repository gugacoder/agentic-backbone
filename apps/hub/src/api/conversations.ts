import { queryOptions } from "@tanstack/react-query";
import { convertSDKMessages, type Message } from "@codrstudio/openclaude-chat";
import { request } from "@/lib/api";

// ── Types ────────────────────────────────────────────────────

export interface Session {
  session_id: string;
  user_id: string;
  agent_id: string;
  channel_id: string | null;
  sdk_session_id: string | null;
  title: string | null;
  starred: number;
  takeover_by: string | null;
  takeover_at: string | null;
  orchestration_path: string | null;
  current_agent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TakeoverResult {
  sessionId: string;
  takenOverBy: string;
  takenOverAt: string;
}

export interface ReleaseResult {
  sessionId: string;
  released: boolean;
}

export interface Conversation {
  id: string;
  agentId: string;
  title?: string;
  updatedAt: string;
  starred: boolean;
  takeover_by: string | null;
  takeover_at: string | null;
}

// ── Query options (kept for takeover metadata) ──────────────

function sessionToConversation(s: Session): Conversation {
  return {
    id: s.session_id,
    agentId: s.agent_id,
    title: s.title ?? undefined,
    updatedAt: s.updated_at,
    starred: s.starred === 1,
    takeover_by: s.takeover_by,
    takeover_at: s.takeover_at,
  };
}

export function conversationQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["conversations", id],
    queryFn: async () => {
      const session = await request<Session>(`/conversations/${id}`);
      return sessionToConversation(session);
    },
  });
}

export function sessionQueryOptions(sessionId: string) {
  return queryOptions({
    queryKey: ["conversations", sessionId, "session"],
    queryFn: () => request<Session>(`/conversations/${sessionId}`),
  });
}

export function conversationMessagesQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["conversations", id, "messages"],
    queryFn: async (): Promise<Message[]> => {
      const res = await request<{ messages: unknown[] }>(
        `/conversations/${id}/messages?limit=200`,
      );
      return convertSDKMessages(res.messages as Parameters<typeof convertSDKMessages>[0]);
    },
  });
}

export function agentConversationsQueryOptions(agentId: string) {
  return queryOptions({
    queryKey: ["conversations", { agentId }],
    queryFn: async () => {
      const sessions = await request<Session[]>(`/conversations?agent_id=${encodeURIComponent(agentId)}`);
      return sessions.map(sessionToConversation);
    },
  });
}

// ── Takeover mutations ──────────────────────────────────────

export async function takeoverConversation(sessionId: string): Promise<TakeoverResult> {
  return request<TakeoverResult>(`/conversations/${sessionId}/takeover`, {
    method: "POST",
  });
}

export async function releaseConversation(sessionId: string): Promise<ReleaseResult> {
  return request<ReleaseResult>(`/conversations/${sessionId}/release`, {
    method: "POST",
  });
}
