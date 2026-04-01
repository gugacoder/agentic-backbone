import { createFileRoute } from "@tanstack/react-router";
import { KnowledgeTab } from "@/components/agents/knowledge-tab";

export const Route = createFileRoute("/_authenticated/agents/$id/knowledge")({
  staticData: { title: "Knowledge", description: "Base de conhecimento do agente" },
  component: AgentKnowledgePage,
});

function AgentKnowledgePage() {
  const { id } = Route.useParams();
  return <KnowledgeTab agentId={id} />;
}
