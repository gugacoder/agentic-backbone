import { createFileRoute } from "@tanstack/react-router";
import { ConversationChatPage } from "@/components/conversations/conversation-chat";

type ConversationSearch = { action?: "rename" | "delete" };

export const Route = createFileRoute("/_authenticated/agents/$id/conversations/$convId")({
  staticData: { title: "Conversa" },
  validateSearch: (search: Record<string, unknown>): ConversationSearch => ({
    action:
      search.action === "rename" || search.action === "delete"
        ? search.action
        : undefined,
  }),
  component: AgentConversationChatWrapper,
});

function AgentConversationChatWrapper() {
  const { id: agentId, convId } = Route.useParams();
  return (
    <ConversationChatPage
      id={convId}
      basePath={`/agents/${agentId}/conversations`}
    />
  );
}
