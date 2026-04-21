import { createFileRoute } from "@tanstack/react-router";
import { KbExplorer } from "@/components/agents/kb/kb-explorer";

export const Route = createFileRoute("/_authenticated/agents/$id/memory")({
  staticData: {
    title: "Knowledge Base",
    description: "Explorador da KB do agente (modelo LYT)",
  },
  component: AgentMemoryPage,
});

function AgentMemoryPage() {
  const { id } = Route.useParams();
  return <KbExplorer agentId={id} />;
}
