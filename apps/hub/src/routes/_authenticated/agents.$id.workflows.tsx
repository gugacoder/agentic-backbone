import { createFileRoute } from "@tanstack/react-router";
import { WorkflowsTab } from "@/components/agents/workflows-tab";

export const Route = createFileRoute("/_authenticated/agents/$id/workflows")({
  staticData: { title: "Workflows", description: "Workflows associados ao agente" },
  component: AgentWorkflowsPage,
});

function AgentWorkflowsPage() {
  const { id } = Route.useParams();
  return <WorkflowsTab agentId={id} />;
}
