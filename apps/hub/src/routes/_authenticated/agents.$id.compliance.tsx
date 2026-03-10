import { createFileRoute } from "@tanstack/react-router";
import { ComplianceTab } from "@/components/agents/compliance-tab";

export const Route = createFileRoute("/_authenticated/agents/$id/compliance")({
  staticData: { title: "Conformidade", description: "Regras de conformidade do agente" },
  component: AgentCompliancePage,
});

function AgentCompliancePage() {
  const { id } = Route.useParams();
  return <ComplianceTab agentId={id} />;
}
