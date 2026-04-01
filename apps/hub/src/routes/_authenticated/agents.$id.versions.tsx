import { createFileRoute } from "@tanstack/react-router";
import { VersionsTab } from "@/components/versions/versions-tab";

export const Route = createFileRoute("/_authenticated/agents/$id/versions")({
  staticData: { title: "Versões", description: "Histórico de versões do agente" },
  component: AgentVersionsPage,
});

function AgentVersionsPage() {
  const { id } = Route.useParams();
  return <VersionsTab agentId={id} />;
}
