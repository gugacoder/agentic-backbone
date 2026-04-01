import { createFileRoute } from "@tanstack/react-router";
import { ConversationChatPage } from "@/components/conversations/conversation-chat";

type ConversationSearch = { action?: "rename" | "delete" };

export const Route = createFileRoute("/_authenticated/conversations/$id")({
  staticData: { title: "Conversa" },
  validateSearch: (search: Record<string, unknown>): ConversationSearch => ({
    action:
      search.action === "rename" || search.action === "delete"
        ? search.action
        : undefined,
  }),
  component: ConversationChatWrapper,
});

function ConversationChatWrapper() {
  const { id } = Route.useParams();
  return <ConversationChatPage id={id} basePath="/conversations" />;
}
