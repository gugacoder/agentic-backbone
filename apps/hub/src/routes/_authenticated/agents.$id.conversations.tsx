import { createFileRoute } from "@tanstack/react-router";
import { AgentConversations } from "@/components/agents/agent-conversations";
import { useQuery } from "@tanstack/react-query";
import { agentQueryOptions } from "@/api/agents";

export const Route = createFileRoute("/_authenticated/agents/$id/conversations")({
  staticData: { title: "Conversas", description: "Histórico de conversas do agente" },
  component: AgentConversationsPage,
});

function AgentConversationsPage() {
  const { id } = Route.useParams();
  const { data: agent } = useQuery(agentQueryOptions(id));

  return <AgentConversations agentId={id} agentSlug={agent?.slug ?? id} />;
}
