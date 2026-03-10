import { createFileRoute } from "@tanstack/react-router";
import { MemoryStatusPanel } from "@/components/agents/memory-status-panel";

export const Route = createFileRoute("/_authenticated/agents/$id/memory")({
  staticData: { title: "Memória", description: "Memória semântica do agente" },
  component: AgentMemoryPage,
});

function AgentMemoryPage() {
  const { id } = Route.useParams();
  return <MemoryStatusPanel agentId={id} />;
}
