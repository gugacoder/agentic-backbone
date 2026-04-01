import { createFileRoute } from "@tanstack/react-router";
import { HandoffsTab } from "@/components/handoffs/handoffs-tab";

export const Route = createFileRoute("/_authenticated/agents/$id/handoffs")({
  staticData: { title: "Handoffs", description: "Regras de transferência entre agentes" },
  component: AgentHandoffsPage,
});

function AgentHandoffsPage() {
  const { id } = Route.useParams();
  return <HandoffsTab agentId={id} />;
}
