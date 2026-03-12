import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ConversationsLayout } from "@/components/conversations/conversations-layout";

type AgentConversationsSearch = { action?: string };

export const Route = createFileRoute("/_authenticated/agents/$id/conversations")({
  validateSearch: (search: Record<string, unknown>): AgentConversationsSearch => ({
    action: typeof search.action === "string" ? search.action : undefined,
  }),
  component: AgentConversationsPage,
});

function AgentConversationsPage() {
  const { id: agentId } = Route.useParams();
  return (
    <ConversationsLayout
      fixedAgentId={agentId}
      basePath={`/agents/${agentId}/conversations`}
    />
  );
}
